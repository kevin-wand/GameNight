import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { supabase } from '@/services/supabase';
import { format } from 'date-fns';
import { Poll, PollEvent } from '@/types/poll';
import { TruncatedText } from '@/components/TruncatedText';
import { EventDateResultCard } from '@/components/EventDateResultCard';
import { useEventResults } from '@/hooks/useEventResults';
import { useTheme } from '@/hooks/useTheme';
import { censor } from '@/utils/profanityFilter';
import Toast from 'react-native-toast-message';

// Helper function to format time strings (HH:mm format) to readable format
const formatTimeString = (timeString: string | null): string => {
  if (!timeString) return '';

  try {
    // Parse time string (HH:mm format) and create a date object for today
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return format(date, 'h:mm a');
  } catch (error) {
    console.error('Error formatting time:', timeString, error);
    return timeString; // Return original string if formatting fails
  }
};

// Extend Poll type for event-specific data
interface Event extends Poll {
  location?: string;
  start_time?: string | null;
  end_time?: string | null;
  use_same_location?: boolean;
  use_same_time?: boolean;
  date_specific_options?: Record<string, any>;
}

// Helper function to get ranking color
const getRankingColor = (rank: number) => {
  switch (rank) {
    case 1:
      return '#ffd700'; // Gold
    case 2:
      return '#c0c0c0'; // Silver
    case 3:
      return '#cd7f32'; // Bronze
    default:
      return '#6b7280'; // Gray
  }
};

// Helper function to get ordinal suffix
const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
};



export default function EventResultsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [newEventVotes, setNewEventVotes] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const { event, eventDates, dateResults, comments, creatorName, loading, error, reload } = useEventResults(id);

  const styles = useMemo(() => getStyles(colors, typography, insets), [colors, typography, insets]);



  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Real-time listener for event votes
  useEffect(() => {
    if (!id || !eventDates || eventDates.length === 0) return;
    const dateIds = new Set(eventDates.map((d: any) => d.id));
    const channel = supabase
      .channel('votes-events-results-listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes_events',
        },
        (payload: any) => {
          const pollEventId = payload?.new?.poll_event_id || payload?.record?.poll_event_id;
          if (pollEventId && dateIds.has(pollEventId)) {
            setNewEventVotes(true);
          }
        }
      )
      .subscribe();
    subscriptionRef.current = channel;
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [id, eventDates]);

  // Show toast when new event votes arrive
  useEffect(() => {
    if (newEventVotes) {
      Toast.show({ type: 'info', text1: 'New event votes received', text2: 'Refresh to update' });
      setNewEventVotes(false);
    }
  }, [newEventVotes]);


  if (loading) return <LoadingState />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          router.replace({ pathname: '/event/[id]/results', params: { id: id as string } });
        }}
      />
    );
  }

  if (!event) {
    return (
      <ErrorState
        message="Event not found"
        onRetry={() => {
          router.replace({ pathname: '/event/[id]/results', params: { id: id as string } });
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/events')}
          accessibilityLabel="Back to events"
          accessibilityRole="button"
          accessibilityHint="Returns to the events list"
        >
          <Text style={styles.backLink}>&larr; Back to Events</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Event Results</Text>
        <Text style={styles.subtitle}>{event.title}</Text>
        <Text style={styles.subtitle}>
          Poll created by {creatorName}
        </Text>
      </View>

      {!user && (
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>
            Want to create your own events?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/register')}
            accessibilityLabel="Sign up for free"
            accessibilityRole="button"
            accessibilityHint="Opens the registration screen to create an account"
          >
            <Text style={styles.signUpLink}>Sign up for free</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Event Dates */}
        <View style={styles.dateResults}>
          <Text style={styles.sectionTitle}>Event Date Rankings</Text>
          {dateResults.length === 0 ? (
            <Text style={styles.emptyText}>No votes have been cast yet.</Text>
          ) : (
            dateResults.map((eventDate) => {
              const displayLocation = event.use_same_location && event.location
                ? event.location
                : eventDate.date.location || 'Location not set';
              const getDisplayTime = (startTime: string | null, endTime: string | null): string => {
                if (startTime) {
                  startTime = formatTimeString(startTime);
                }
                if (endTime) {
                  endTime = formatTimeString(endTime);
                }
                if (startTime && endTime) {
                  return ` ${startTime} - ${endTime}`;
                } else if (startTime) {
                  return ` Starts at ${startTime}`;
                } else if (endTime) {
                  return ` Ends at ${endTime}`;
                } else {
                  return ' Time not set';
                }
              };
              let displayTime;
              if (event.use_same_time && (event.start_time || event.end_time)) {
                displayTime = getDisplayTime(event.start_time || null, event.end_time || null);
              } else {
                displayTime = getDisplayTime(eventDate.date.start_time || null, eventDate.date.end_time || null);
              }

              return (
                <EventDateResultCard
                  key={eventDate.date.id}
                  eventDate={eventDate}
                  votes={eventDate.votes}
                  displayLocation={displayLocation}
                  displayTime={displayTime}
                />
              );
            })
          )}
        </View>

        {/* Comments Section */}
        {comments?.length > 0 && (
          <View style={styles.commentsContainer}>
            <Text style={styles.commentsTitle}>Comments</Text>
            {comments.map((comment, index) => (
              <View key={index} style={styles.commentItem}>
                <Text style={styles.commentAuthor}>
                  {comment.username
                    ? (comment.firstname || comment.lastname
                      ? `${censor([comment.firstname, comment.lastname].join(' ').trim())} (${comment.username})`
                      : comment.username
                    ) : censor(comment.voter_name) || 'Anonymous'}
                </Text>
                <Text style={styles.commentText}>{comment.comment_text}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      <View style={styles.bottomActionsContainer}>
        <TouchableOpacity
          style={styles.backToVotingButton}
          onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
          accessibilityLabel="Back to voting"
          accessibilityRole="button"
          accessibilityHint="Returns to the voting screen for this event"
        >
          <Text style={styles.backToVotingButtonText}>Back to Voting</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors: any, typography: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Math.max(40, insets.top),
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: typography.fontSize.title2,
    fontFamily: typography.getFontFamily('bold'),
    color: colors.card,
    marginBottom: 8,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title1,
  },
  subtitle: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.card,
    opacity: 0.8,
  },
  backLink: {
    color: colors.accent,
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    marginBottom: 8,
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingBottom: insets.bottom + 20,
    width: '100%',
    alignSelf: 'stretch',
  },
  signUpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
  },
  signUpLink: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  bottomActionsContainer: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: Math.max(20, insets.bottom),
  },
  backToVotingButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    margin: 8,
  },
  backToVotingButtonText: {
    fontSize: typography.fontSize.body,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.card,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  overallStats: {
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.primary,
    marginBottom: 16,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 6,
    marginBottom: 12,
  },
  statNumber: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title1,
    color: colors.primary,
    marginTop: 8,
  },
  statLabel: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  dateResults: {
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateResultCard: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateResultHeader: {
    marginBottom: 16,
  },
  rankingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankingBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankingNumber: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.card,
  },
  rankingInfo: {
    flex: 1,
  },
  rankingLabel: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.primary,
    marginBottom: 2,
  },
  scoreText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.primary,
    marginBottom: 8,
  },
  dateDetails: {
    marginVertical: -2,
  },
  dateDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateDetailText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
    marginLeft: 6,
  },
  voteBreakdown: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  voteBreakdownText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
  },
  emptyText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    padding: 20,
  },
  truncateButtonText: {
    color: colors.accent,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('semibold'),
    textDecorationLine: 'underline',
  },
  commentsContainer: {
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentsTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.primary,
    marginBottom: 16,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title3,
  },
  commentItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentAuthor: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.primary,
    marginBottom: 4,
  },
  commentText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.text,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
});
