// hooks/usePollData.ts

import { useEffect, useState } from 'react';
import { getOrCreateAnonId } from '@/utils/anon';
import { supabase } from '@/services/supabase';
import { Poll, Vote } from '@/types/poll';
import { Game } from '@/types/game';

export enum VoteType {
  THUMBS_DOWN = 'thumbs_down',
  THUMBS_UP = 'thumbs_up',
  DOUBLE_THUMBS_UP = 'double_thumbs_up',
}

interface GameVotes {
  thumbs_down: number;
  thumbs_up: number;
  double_thumbs_up: number;
  voters: { name: string; vote_type: VoteType }[];
}

interface PollGame extends Game {
  votes: GameVotes;
  userVote?: VoteType | null;
}

export const usePollData = (pollId: string | string[] | undefined) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [games, setGames] = useState<PollGame[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [pendingVotes, setPendingVotes] = useState<Record<number, VoteType>>({});
  const [identifier, setIdentifier] = useState<string | null>(null);

  useEffect(() => {
    if (pollId) loadPoll(pollId.toString());
  }, [pollId]);

  const loadPoll = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading poll with ID:', id);

      // Get the poll details
      const { data: pollData, error: pollError } = await supabase
        .from('polls')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pollError) {
        console.error('Poll error:', pollError);
        throw new Error('Poll not found or has been deleted');
      }

      if (!pollData) {
        throw new Error('Poll not found');
      }

      console.log('Poll data loaded:', pollData);
      setPoll(pollData);

      // Get current user (may be null for anonymous users)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.warn('User auth error (continuing as anonymous):', userError);
      }

      setUser(user);
      setIsCreator(user?.id === pollData.user_id);

      // Get the games in this poll
      const { data: pollGames, error: gamesError } = await supabase
        .from('poll_games')
        .select('game_id')
        .eq('poll_id', id);

      if (gamesError) {
        console.error('Poll games error:', gamesError);
        throw gamesError;
      }

      console.log('Poll games:', pollGames);

      if (!pollGames || pollGames.length === 0) {
        console.log('No games found in poll');
        setGames([]);
        setLoading(false);
        return;
      }

      const gameIds = pollGames.map(pg => pg.game_id);
      console.log('Game IDs to fetch:', gameIds);

      // Get the actual game details from games table
      const { data: gamesData, error: gameDetailsError } = await supabase
        .from('games')
        .select('*')
        .in('id', gameIds);

      if (gameDetailsError) {
        console.error('Game details error:', gameDetailsError);
        throw gameDetailsError;
      }

      console.log('Games data loaded:', gamesData);

      if (!gamesData || gamesData.length === 0) {
        console.log('No game details found');
        setGames([]);
        setLoading(false);
        return;
      }

      // Get votes for this poll
      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('poll_id', id);

      if (votesError) {
        console.error('Votes error:', votesError);
        throw votesError;
      }

      console.log('Votes loaded:', votes);

      // Get user identifier for vote checking
      let newIdentifier = null;
      if (user?.email) {
        newIdentifier = user.email;
      } else {
        try {
          const anonId = await getOrCreateAnonId();
          newIdentifier = anonId;
        } catch (anonError) {
          console.warn('Could not get anonymous ID:', anonError);
        }
      }
      setIdentifier(newIdentifier);

      console.log('User identifier:', identifier);

      const userVotes = votes?.filter(v => v.voter_name === identifier) || [];
      setHasVoted(userVotes.length > 0 || user?.id === pollData.user_id);

      // Map games data to the expected format
      const formattedGames = gamesData.map(game => {
        // Find votes for this specific game using the game's ID
        const gameVotes = votes?.filter(v => v.game_id === game.id) || [];

        const voteData: GameVotes = {
          thumbs_down: gameVotes.filter(v => v.vote_type === VoteType.THUMBS_DOWN).length,
          thumbs_up: gameVotes.filter(v => v.vote_type === VoteType.THUMBS_UP).length,
          double_thumbs_up: gameVotes.filter(v => v.vote_type === VoteType.DOUBLE_THUMBS_UP).length,
          voters: gameVotes.map(v => ({
            name: v.voter_name || 'Anonymous',
            vote_type: v.vote_type as VoteType,
          })),
        };

        // Find user's vote for this game
        const userVote = identifier ?
          gameVotes.find(v => v.voter_name === identifier)?.vote_type as VoteType || null
          : null;

        return {
          id: game.id,
          name: game.name || 'Unknown Game',
          yearPublished: game.year_published || null,
          thumbnail: game.image_url || 'https://via.placeholder.com/150?text=No+Image',
          image: game.image_url || 'https://via.placeholder.com/300?text=No+Image',
          min_players: game.min_players || 1,
          max_players: game.max_players || 1,
          playing_time: game.playing_time || 0,
          minPlaytime: game.minplaytime || 0,
          maxPlaytime: game.maxplaytime || 0,
          description: game.description || '',
          minAge: game.min_age || 0,
          is_cooperative: game.is_cooperative || false,
          complexity: game.complexity || 1,
          complexity_tier: game.complexity_tier || 1,
          complexity_desc: game.complexity_desc || '',
          average: game.average ?? null, // <-- Added this line
          bayesaverage: game.bayesaverage ?? null, // <-- Add this line for type compatibility
          votes: voteData,
          userVote,
        };
      });

      console.log('Formatted games:', formattedGames);

      // Set initial pending votes from user's existing votes
      const initialVotes: Record<number, VoteType> = {};
      userVotes.forEach(v => {
        if (v.game_id && v.vote_type) {
          initialVotes[v.game_id] = v.vote_type as VoteType;
        }
      });

      setGames(formattedGames);
      setPendingVotes(initialVotes);
      // For anonymous users, try to load votes from local storage
      if (!user) {
        try {
          const savedVotes = await (await import('@react-native-async-storage/async-storage')).default.getItem(`poll_votes_${id}`);
          if (savedVotes) {
            setPendingVotes(JSON.parse(savedVotes));
          }
        } catch { }
      }
    } catch (err) {
      console.error('Error in loadPoll:', err);
      setError((err as Error).message || 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  };

  return {
    poll,
    games,
    hasVoted,
    isCreator,
    loading,
    error,
    user,
    pendingVotes,
    setPendingVotes,
    reload: () => pollId && loadPoll(pollId.toString()),
    identifier,
  };
};