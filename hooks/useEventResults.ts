import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { Poll, PollEvent } from '@/types/poll';
import { EVENT_VOTING_OPTIONS } from '@/components/eventVotingOptions';
import { censor } from '@/utils/profanityFilter';

interface EventVotes {
  votes: Record<string, number>; // voteType1: 3, voteType2: 1, etc.
  voters: { name: string; vote_type: number }[];
}

interface EventDateResult {
  date: PollEvent;
  ranking: number;
  isTied?: boolean;
  totalScore: number;
  totalVotes: number;
  voteCounts: { yes: number; no: number; maybe: number };
  votes: EventVotes;
}

interface EventResult {
  event: Poll & {
    poll_events: PollEvent[];
    location?: string;
    start_time?: string | null;
    end_time?: string | null;
    use_same_location?: boolean;
    use_same_time?: boolean;
    date_specific_options?: Record<string, any>;
  };
  eventDates: PollEvent[];
  dateResults: EventDateResult[];
  comments: { username: string; firstname: string; lastname: string; voter_name: string; comment_text: string }[];
  creatorName: string;
  loading: boolean;
  error: string | null;
}

export const useEventResults = (eventId: string | string[] | undefined) => {
  const [event, setEvent] = useState<EventResult['event'] | null>(null);
  const [eventDates, setEventDates] = useState<PollEvent[]>([]);
  const [dateResults, setDateResults] = useState<EventDateResult[]>([]);
  const [comments, setComments] = useState<{ username: string; firstname: string; lastname: string; voter_name: string; comment_text: string }[]>([]);
  const [creatorName, setCreatorName] = useState<string>('Loading...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the last eventId to prevent unnecessary re-fetches
  const lastEventIdRef = useRef<string | null>(null);

  const loadEventResults = useCallback(async (id: string) => {
    // Prevent duplicate requests for the same eventId
    if (lastEventIdRef.current === id) {
      return;
    }

    lastEventIdRef.current = id;

    try {
      setLoading(true);
      setError(null);

      // Load event details (only polls that have poll_events - these are events)
      const { data: eventData, error: eventError } = await supabase
        .from('polls')
        .select(`
          *,
          poll_events!inner(
            id,
            event_date,
            start_time,
            end_time,
            location
          )
        `)
        .eq('id', id)
        .single();

      if (eventError) {
        console.error('Event error:', eventError);
        throw new Error('Event not found or this is not an event poll');
      }

      if (!eventData) {
        throw new Error('Event not found or this is not an event poll');
      }

      setEvent(eventData);

      // Load event dates
      const { data: datesData, error: datesError } = await supabase
        .from('poll_events')
        .select('*')
        .eq('poll_id', id)
        .order('event_date', { ascending: true });

      if (datesError) {
        console.error('Event dates error:', datesError);
        throw datesError;
      }

      setEventDates(datesData || []);

      // Fetch creator info
      const fetchCreatorInfo = async () => {
        const { data, error } = await supabase
          .from('polls_profiles')
          .select('username, firstname, lastname')
          .eq('id', id)
          .maybeSingle();
        if (!error && data) {
          const { username, firstname, lastname } = data;
          setCreatorName(
            firstname || lastname
              ? `${censor([firstname, lastname].join(' ').trim())} (${username})`
              : username
          );
        }
      };
      await fetchCreatorInfo();

      // Fetch poll comments
      const fetchComments = async () => {
        const { data, error } = await supabase
          .from('poll_comments_view')
          .select('username, firstname, lastname, voter_name, comment_text')
          .eq('poll_id', id)
          .order('created_at', { ascending: false });
        if (!error && data) setComments(data);
      };
      await fetchComments();

      // Fetch individual voter data
      const fetchVoterData = async () => {
        if (!datesData || datesData.length === 0) return {};

        const { data, error } = await supabase
          .from('votes_events_view')
          .select('poll_event_id, vote_type, username, firstname, lastname, voter_name')
          .in('poll_event_id', datesData.map(d => d.id));

        if (error) {
          console.error('Error fetching voter data:', error);
          return {};
        }

        // Group voters by event date
        const voterMap: Record<string, { name: string; vote_type: number }[]> = {};

        data?.forEach(vote => {
          const dateId = vote.poll_event_id;
          if (!voterMap[dateId]) {
            voterMap[dateId] = [];
          }

          // Get voter name (prefer username, fallback to voter_name)
          const voterName = vote.username
            ? (vote.firstname || vote.lastname
              ? `${[vote.firstname, vote.lastname].join(' ').trim()} (${vote.username})`
              : vote.username
            ) : vote.voter_name || 'Anonymous';

          voterMap[dateId].push({
            name: voterName,
            vote_type: vote.vote_type
          });
        });

        return voterMap;
      };
      const voterData = await fetchVoterData();

      // Load vote counts and calculate rankings
      const loadVoteCounts = async (dates: PollEvent[]) => {
        if (!dates || dates.length === 0) return [];

        try {
          // Load all votes for this event's dates
          const { data: votesData, error: votesError } = await supabase
            .from('votes_events')
            .select('*')
            .in('poll_event_id', dates.map(d => d.id));

          if (votesError) {
            console.error('Error loading votes:', votesError);
            return [];
          }

          // Calculate vote counts for each date
          const counts: Record<string, { yes: number; no: number; maybe: number }> = {};

          dates.forEach(date => {
            counts[date.id] = { yes: 0, no: 0, maybe: 0 };
          });

          votesData?.forEach(vote => {
            const dateId = vote.poll_event_id;
            if (counts[dateId]) {
              switch (vote.vote_type) {
                case 2: counts[dateId].yes++; break;
                case 1: counts[dateId].maybe++; break;
                case -2: counts[dateId].no++; break;
              }
            }
          });

          // Calculate scores and rankings
          const dateScores = dates.map(date => {
            const dateCounts = counts[date.id] || { yes: 0, no: 0, maybe: 0 };
            const totalVotes = dateCounts.yes + dateCounts.maybe + dateCounts.no;
            const totalScore = (dateCounts.yes * 2) + (dateCounts.maybe * 1) + (dateCounts.no * -2);

            return {
              date,
              totalScore,
              totalVotes,
              voteCounts: dateCounts,
              votes: {
                votes: EVENT_VOTING_OPTIONS.reduce((acc, option) => {
                  switch (option.value) {
                    case 2: acc[option.value.toString()] = dateCounts.yes; break;    // Ideal
                    case 1: acc[option.value.toString()] = dateCounts.maybe; break;  // Doable
                    case -2: acc[option.value.toString()] = dateCounts.no; break;    // No
                  }
                  return acc;
                }, {} as Record<string, number>),
                voters: voterData[date.id] || []
              }
            };
          });

          // Sort by score (descending) and assign competition rankings (1, 1, 3)
          dateScores.sort((a, b) => b.totalScore - a.totalScore);

          const scoreCounts: Record<number, number> = {};
          dateScores.forEach((item) => {
            scoreCounts[item.totalScore] = (scoreCounts[item.totalScore] || 0) + 1;
          });

          let currentRank = 1;
          let lastScore: number | null = null;

          const results: EventDateResult[] = dateScores.map((item, index) => {
            if (lastScore !== null && item.totalScore !== lastScore) {
              currentRank = index + 1;
            }
            lastScore = item.totalScore;

            return {
              date: item.date,
              ranking: currentRank,
              isTied: scoreCounts[item.totalScore] > 1,
              totalScore: item.totalScore,
              totalVotes: item.totalVotes,
              voteCounts: item.voteCounts,
              votes: item.votes
            };
          });

          return results;
        } catch (err) {
          console.error('Error in loadVoteCounts:', err);
          return [];
        }
      };

      const results = await loadVoteCounts(datesData || []);
      setDateResults(results);

    } catch (err) {
      console.error('Error in loadEventResults:', err);
      setError((err as Error).message || 'Failed to load event results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (eventId && typeof eventId === 'string') {
      loadEventResults(eventId);
    }
  }, [eventId, loadEventResults]);

  const reload = useCallback(() => {
    if (eventId && typeof eventId === 'string') {
      lastEventIdRef.current = null; // Reset the ref to allow re-fetch
      loadEventResults(eventId);
    }
  }, [eventId, loadEventResults]);

  return {
    event,
    eventDates,
    dateResults,
    comments,
    creatorName,
    loading,
    error,
    reload,
  };
};
