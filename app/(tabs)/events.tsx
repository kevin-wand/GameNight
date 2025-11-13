import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import * as Clipboard from 'expo-clipboard';

import { supabase } from '@/services/supabase';
import { Poll, PollEvent } from '@/types/poll';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import CreateEventModal from '@/components/CreateEventModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { EmptyStateEvents } from '@/components/EmptyStateEvents';
import { useEventResults } from '@/hooks/useEventResults';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';


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

type TabType = 'all' | 'created' | 'invited';

// Extend Poll type locally for voteCount and event-specific data
interface EventWithVoteCount extends Poll {
  voteCount: number;
  eventOptions: PollEvent[];
}

// Profile type for creator information
interface Profile {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
}

export default function EventsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const [events, setEvents] = useState<EventWithVoteCount[]>([]);
  const [allEvents, setAllEvents] = useState<EventWithVoteCount[]>([]);
  const [otherUsersEvents, setOtherUsersEvents] = useState<EventWithVoteCount[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventWithVoteCount | null>(null);
  const [showShareLink, setShowShareLink] = useState<string | null>(null);
  const [showCopiedConfirmation, setShowCopiedConfirmation] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openResultsEventId, setOpenResultsEventId] = useState<string | null>(null);


  // Memoize the loadEvents function to prevent unnecessary re-creations
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth/login');
        return;
      }
      setCurrentUserId(user.id);

      // Load all events (polls with poll_events) using inner join
      const { data: allEventsData, error: allEventsError } = await supabase
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
        .order('created_at', { ascending: false });

      if (allEventsError) throw allEventsError;


      // Not created yet. Future feature.
      // Fetch creator profiles for all unique user_ids
      const userIds = Array.from(new Set((allEventsData || []).map(e => e.user_id)));
      let creatorMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, firstname, lastname')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach((profile: any) => {
            creatorMap[profile.id] = profile;
          });
        }
      }
      setCreatorMap(creatorMap);

      setAllEvents([]); // will be set below

      // Separate created events and other users' events
      const createdEvents = allEventsData?.filter(event => event.user_id === user.id) || [];

      let otherUsersEvents: EventWithVoteCount[] = [];

      // *****NEED TO UPDATE THIS ONCE VOTE COUNT IS BUILT OUT*****
      // Add eventOptions to each event
      const addEventOptions = (events: any[]): EventWithVoteCount[] =>
        events.map(e => ({
          ...e,
          voteCount: 0,
          eventOptions: e.poll_events || []
        }));

      setEvents(addEventOptions(createdEvents));
      setOtherUsersEvents(addEventOptions(otherUsersEvents));

      // Set allEvents to be the union of createdEvents and otherUsersEvents (no duplicates)
      const uniqueAllEvents: EventWithVoteCount[] = [
        ...addEventOptions(createdEvents),
        ...addEventOptions(otherUsersEvents.filter(
          (event) => !createdEvents.some((myEvent) => myEvent.id === event.id)
        )),
      ];
      // Sort by created_at to ensure proper date ordering
      uniqueAllEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllEvents(uniqueAllEvents);
    } catch (err) {
      console.error('Error loading events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle refresh parameter from URL
  useEffect(() => {
    if (params.refresh === 'true') {
      loadEvents();
      // Clear the refresh parameter from URL
      router.setParams({ refresh: undefined });
    }
  }, [params.refresh, loadEvents, router]);

  // Auto-switch to 'all' tab if 'invited' tab has no events
  useEffect(() => {
    if (activeTab === 'invited' && otherUsersEvents.length === 0) {
      setActiveTab('all');
    }
  }, [activeTab, otherUsersEvents.length]);

  // Removed scaled styling helper for simplicity and HIG clarity

  // Memoize current events to prevent unnecessary re-renders
  const currentEvents = useMemo(() => {
    return activeTab === 'all' ? allEvents : activeTab === 'created' ? events : otherUsersEvents;
  }, [activeTab, allEvents, events, otherUsersEvents]);

  const handleShare = useCallback(async (eventId: string) => {
    // Use a proper base URL for React Native
    const baseUrl = Platform.select({
      web: typeof window !== 'undefined' ? window.location.origin : 'https://klack.netlify.app',
      default: 'https://klack.netlify.app',
    });

    const shareUrl = `${baseUrl}/event/${eventId}`;
    setShowShareLink(shareUrl);

    try {
      if (Platform.OS === 'web') {
        // Web-specific sharing
        if (navigator.share) {
          await navigator.share({
            title: 'Vote on event dates!',
            text: 'Help us decide when to meet by voting on available dates.',
            url: shareUrl,
          });
        } else {
          // Fallback for web browsers without native sharing
          await Clipboard.setStringAsync(shareUrl);
          setShowCopiedConfirmation(true);
          setTimeout(() => {
            setShowCopiedConfirmation(false);
          }, 2000);
        }
      } else {
        // Mobile-specific sharing
        await Clipboard.setStringAsync(shareUrl);
        setShowCopiedConfirmation(true);
        announceForAccessibility('Event link copied to clipboard');
        setTimeout(() => {
          setShowCopiedConfirmation(false);
        }, 2000);
      }
    } catch (err) {
      console.log('Error sharing:', err);
      // Final fallback
      try {
        await Clipboard.setStringAsync(shareUrl);
        setShowCopiedConfirmation(true);
        announceForAccessibility('Event link copied to clipboard');
        setTimeout(() => {
          setShowCopiedConfirmation(false);
        }, 2000);
      } catch (clipboardErr) {
        console.log('Error copying to clipboard:', clipboardErr);
        // Last resort: show the URL in an alert for manual copying
        alert(`Share this link: ${shareUrl}`);
      }
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!eventToDelete) return;

    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', eventToDelete.id);

      if (error) throw error;

      setEventToDelete(null);
      await loadEvents();
      announceForAccessibility('Event deleted successfully');
    } catch (err) {
      console.error('Error deleting event:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  }, [eventToDelete, loadEvents]);

  // Helper to render event results dropdown - memoized to prevent unnecessary re-renders
  const EventResultsDropdown = useCallback(({ eventId }: { eventId: string }) => {
    const { event, eventDates, loading, error } = useEventResults(eventId);
    const [voteCounts, setVoteCounts] = useState<Record<string, { yes: number; no: number; maybe: number }>>({});
    const [votesLoading, setVotesLoading] = useState(true);

    // Load vote counts for event dates
    useEffect(() => {
      const loadVoteCounts = async () => {
        if (!eventDates || eventDates.length === 0) {
          setVotesLoading(false);
          return;
        }

        try {
          setVotesLoading(true);

          // Load all votes for this event's dates
          const { data: votesData, error: votesError } = await supabase
            .from('votes_events')
            .select('*')
            .in('poll_event_id', eventDates.map(d => d.id));

          if (votesError) {
            console.error('Error loading votes:', votesError);
            setVotesLoading(false);
            return;
          }

          // Calculate vote counts for each date
          const counts: Record<string, { yes: number; no: number; maybe: number }> = {};

          eventDates.forEach(date => {
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

          setVoteCounts(counts);
        } catch (err) {
          console.error('Error loading vote counts:', err);
        } finally {
          setVotesLoading(false);
        }
      };

      loadVoteCounts();
    }, [eventDates]);

    if (loading || votesLoading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={() => { }} />;
    if (!eventDates || eventDates.length === 0) return <Text style={{ padding: 16, color: '#888' }}>No event dates available.</Text>;

    return (
      <View style={styles.eventResultsContainer}>
        <Text style={styles.eventResultsTitle}>Event Date Results</Text>

        {/* Table Header */}
        <View style={styles.eventTableHeader}>
          <Text style={styles.eventTableHeaderDate}>Date</Text>
          <Text style={styles.eventTableHeaderVote}>Ideal</Text>
          <Text style={styles.eventTableHeaderVote}>Doable</Text>
          <Text style={styles.eventTableHeaderVote}>No</Text>
        </View>

        {/* Table Rows - sorted by total score */}
        {eventDates
          .map(eventDate => {
            const counts = voteCounts[eventDate.id] || { yes: 0, no: 0, maybe: 0 };
            // Calculate total score: Ideal (2) + Doable (1) - No (-2)
            const totalScore = (counts.yes * 2) + (counts.maybe * 1) + (counts.no * -2);
            return { eventDate, counts, totalScore };
          })
          .sort((a, b) => b.totalScore - a.totalScore) // Sort by total score descending
          .map(({ eventDate, counts }, index) => {
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
            if (event?.use_same_time && (event?.start_time || event?.end_time)) {
              displayTime = getDisplayTime(event.start_time || null, event.end_time || null);
            } else {
              displayTime = getDisplayTime(eventDate.start_time || null, eventDate.end_time || null);
            }

            return (
              <View key={eventDate.id} style={styles.eventTableRow}>
                <View style={styles.eventTableDateCell}>
                  <Text style={styles.eventTableDateText}>
                    {format(new Date(eventDate.event_date), 'MMM d, yyyy')}
                  </Text>
                  <Text style={styles.eventTableDateSubtext}>
                    {displayTime}
                  </Text>
                </View>
                <View style={styles.eventTableVoteCell}>
                  <Text style={[styles.eventTableVoteCount, { color: '#10b981' }]}>{counts.yes}</Text>
                </View>
                <View style={styles.eventTableVoteCell}>
                  <Text style={[styles.eventTableVoteCount, { color: '#f59e0b' }]}>{counts.maybe}</Text>
                </View>
                <View style={styles.eventTableVoteCell}>
                  <Text style={[styles.eventTableVoteCount, { color: '#ef4444' }]}>{counts.no}</Text>
                </View>
              </View>
            );
          })}

        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => router.push({ pathname: '/event/[id]/results', params: { id: eventId } })}
        >
          <Text style={styles.viewDetailsButtonText}>View Full Results</Text>
        </TouchableOpacity>
      </View>
    );
  }, [router]);

  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadEvents} />;
  }

  const isCreator = activeTab === 'created';

  return (
    <View style={styles.container}>
      {currentEvents.length > 0 && (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <SFSymbolIcon name="plus" color="#ffffff" />
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>
          <View style={styles.tabsWrapper}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                  All Events ({allEvents.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'created' && styles.activeTab]}
                onPress={() => setActiveTab('created')}
              >
                <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>
                  My Events ({events.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'invited' && styles.activeTab,
                  otherUsersEvents.length === 0 && styles.disabledTab
                ]}
                onPress={() => otherUsersEvents.length > 0 && setActiveTab('invited')}
                disabled={otherUsersEvents.length === 0}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'invited' && styles.activeTabText,
                  otherUsersEvents.length === 0 && styles.disabledTabText
                ]}>
                  Voted In ({otherUsersEvents.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}



      {showShareLink && (
        <View
          style={styles.shareLinkContainer}
          accessibilityLabel="Share link panel"
          accessibilityRole="summary"
        >
          <View style={styles.shareLinkHeader}>
            <Text style={styles.shareLinkTitle}>Share Link</Text>
            <TouchableOpacity
              accessibilityLabel="Close share link"
              accessibilityRole="button"
              accessibilityHint="Closes the share link panel"
              onPress={() => setShowShareLink(null)}
              style={styles.closeShareLinkButton}
              hitSlop={touchTargets.small}
            >
              <SFSymbolIcon name="x" />
            </TouchableOpacity>
          </View>

          <View style={styles.shareLinkContent}>
            <TextInput
              style={styles.shareLinkInput}
              value={showShareLink}
              editable={false}
              selectTextOnFocus
            />
            <TouchableOpacity
              style={styles.copyButton}
              accessibilityLabel="Copy share link"
              accessibilityRole="button"
              accessibilityHint="Copies the event link to your clipboard"
              hitSlop={touchTargets.small}
              onPress={async () => {
                try {
                  // Copy only the link value, not the text input content
                  await Clipboard.setStringAsync(showShareLink || '');
                  setShowCopiedConfirmation(true);
                  setTimeout(() => {
                    setShowCopiedConfirmation(false);
                  }, 2000);
                } catch (err) {
                  console.log('Error copying to clipboard:', err);
                }
              }}
            >
              {showCopiedConfirmation ? (
                <SFSymbolIcon name="check" />
              ) : (
                <SFSymbolIcon name="copy" />
              )}
            </TouchableOpacity>
          </View>

          {showCopiedConfirmation && (
            <Text style={styles.copiedConfirmation}>Link copied to clipboard!</Text>
          )}
        </View>
      )}

      <FlatList
        data={currentEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isDropdownOpen = openResultsEventId === item.id;
          return (
            <View
              style={styles.eventCard}
            >
              <View style={styles.eventHeaderRow}>
                <Pressable
                  style={({ hovered }) => [
                    styles.eventTitleContainer,
                    hovered && Platform.OS === 'web' ? styles.eventTitleContainerHover : null,
                  ]}
                  accessibilityLabel={`Open event ${item.title}`}
                  accessibilityRole="link"
                  accessibilityHint="Opens the event details"
                  onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}
                >
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventTitleWithIcon} numberOfLines={1}>
                      {item.title.length > 35 ? `${item.title.substring(0, 35)}...` : item.title}
                    </Text>
                  </View>
                  <View style={styles.eventDateContainer}>
                    <SFSymbolIcon name="calendar" />
                    <Text style={styles.eventDateText} numberOfLines={1}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  {item.description && (
                    <Text style={styles.eventDescription}>{item.description}</Text>
                  )}
                  {/* Show event options count */}
                  <Text style={styles.eventOptionsCount}>
                    {item.eventOptions.length} date{item.eventOptions.length !== 1 ? 's' : ''} available
                  </Text>
                </Pressable>
                <View style={styles.eventActionsContainer}>
                  {item.user_id === currentUserId && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      hitSlop={touchTargets.small}
                      accessibilityLabel={`Delete event ${item.title}`}
                      accessibilityRole="button"
                      accessibilityHint="Permanently deletes this event"
                      onPress={() => setEventToDelete(item)}
                    >
                      <SFSymbolIcon name="x" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {/* Action buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.shareButtonDesktop} onPress={() => handleShare(item.id)}
                  accessibilityLabel={`Share event ${item.title}`}
                  accessibilityRole="button"
                  accessibilityHint="Shares the event link">
                  <SFSymbolIcon name="share2" />
                  <Text style={styles.shareLinkButtonTextDesktop}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resultsButtonDesktop}
                  accessibilityLabel={`View results for ${item.title}`}
                  accessibilityRole="button"
                  accessibilityHint="Shows voting results for this event"
                  onPress={() => setOpenResultsEventId(isDropdownOpen ? null : item.id)}
                >
                  <SFSymbolIcon name="barchart3" />
                  <Text style={styles.resultsButtonTextDesktop}>
                    Results
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Dropdown below event card (unified) */}
              {isDropdownOpen && (
                <View style={styles.dropdownContainer}>
                  <EventResultsDropdown eventId={item.id} />
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          currentEvents.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={
          <EmptyStateEvents onCreate={() => setCreateModalVisible(true)} />
        }
      />

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          loadEvents();
        }}
      />

      <ConfirmationDialog
        isVisible={eventToDelete !== null}
        title="Delete Event"
        message={`Are you sure you want to delete "${eventToDelete?.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setEventToDelete(null)}
      />
    </View>
  );
}

const getStyles = (colors: any, typography: any) => {
  // Theme-aware translucent tints to differentiate buttons from card
  const accentTint = colors.tints.accent;
  const primaryTint = colors.tints.primary;
  const errorTint = colors.tints.error;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
    },
    header: {
      paddingTop: 12,
      paddingHorizontal: 0,
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minHeight: 44,
      marginRight: 8,
    },
    createButtonText: {
      marginLeft: 4,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
    tabsWrapper: {
      width: '100%',
      marginTop: 8,
      marginBottom: 8,
      alignItems: 'flex-start',
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 4,
      paddingHorizontal: 0,
      flexShrink: 1,
    },
    tab: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      minHeight: 44,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeTab: {
      backgroundColor: colors.tints.primary,
      //borderColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    tabText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
    },
    activeTabText: {
      color: colors.primary,
      fontFamily: typography.getFontFamily('semibold'),
    },
    disabledTab: {
      opacity: 0.5,
      pointerEvents: 'none',
      backgroundColor: colors.tints.neutral,
      borderColor: colors.border,
    },
    disabledTabText: {
      color: colors.textMuted,
    },
    eventHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    eventTitleRow: {
      marginBottom: 2,
    },
    eventTitleWithIcon: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.primary,
      textDecorationLine: 'underline',
      paddingTop: 8,
      marginBottom: 0,
      flexShrink: 1,
    },
    eventDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    eventDateIcon: {
      paddingTop: 8,
      marginBottom: 0,
      marginRight: 4,
    },
    eventDateText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
      paddingTop: 8,
      marginBottom: 0,
    },
    eventActionsContainer: {
      alignItems: 'flex-end',
      minWidth: 40,
    },
    dropdownContainer: {
      marginTop: 8,
    },
    shareLinkContainer: {
      marginHorizontal: 0,
      marginVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    shareLinkHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    shareLinkTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.primary,
    },
    closeShareLinkButton: {
      padding: 4,
      borderRadius: 12,
    },
    shareLinkContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    shareLinkInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    copyButton: {
      paddingTop: 14,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 2,
      backgroundColor: colors.card,
      borderRadius: 8,
      minHeight: 44,
    },
    copiedConfirmation: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.success,
      marginTop: 8,
      textAlign: 'center',
    },
    listContent: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 60, // Base padding for tab bar
    },
    emptyListContent: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 40,
      paddingHorizontal: 20,
    },
    eventCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    eventTitleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    eventTitleContainerHover: {
      backgroundColor: colors.background,
    },
    eventTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.primary,
      marginBottom: 4,
      paddingTop: 8, // Add padding to shift title down
    },
    eventDescription: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      marginBottom: 8,
    },
    eventDate: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
    },
    eventOptionsCount: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.success,
      marginTop: 4,
    },
    deleteButton: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      borderRadius: 12,
      marginLeft: 8,
      backgroundColor: errorTint,
    },
    shareButtonDesktop: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: accentTint,
      borderRadius: 10,
      paddingVertical: 12,
      justifyContent: 'center',
      minHeight: 44,
      marginRight: 8,
      marginBottom: 8,
    },
    shareLinkButtonTextDesktop: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.accent,
    },

    resultsButtonDesktop: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: primaryTint,
      borderRadius: 10,
      paddingVertical: 12,
      justifyContent: 'center',
      minHeight: 44,
      marginLeft: 8,
      marginBottom: 8,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 18,
    },
    resultsButtonTextDesktop: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.primary,
    },

    // Event Results Dropdown Styles
    eventResultsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eventResultsTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.primary,
      marginBottom: 16,
    },
    // Table Styles
    eventTableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eventTableHeaderDate: {
      flex: 2,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: colors.primary,
    },
    eventTableHeaderVote: {
      flex: 1,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: colors.primary,
      textAlign: 'center',
    },
    eventTableRow: {
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: 'center',
    },
    eventTableDateCell: {
      flex: 2,
    },
    eventTableDateText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: colors.primary,
      marginBottom: 2,
    },
    eventTableDateSubtext: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
    },
    eventTableVoteCell: {
      flex: 1,
      alignItems: 'center',
    },
    eventTableVoteCount: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
    },
    viewDetailsButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      marginTop: 12,
      minHeight: 44,
    },
    viewDetailsButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
  });
};