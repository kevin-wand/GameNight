import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibility } from '@/hooks/useAccessibility';

import { supabase } from '@/services/supabase';
import { Poll } from '@/types/poll';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { CreatePollModal } from '@/components/CreatePollModal';
import { EditPollModal } from '@/components/EditPollModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { EmptyStatePolls } from '@/components/EmptyStatePolls';
import { PollScreenCard } from '@/components/PollScreenCard';
import { usePollResults } from '@/hooks/usePollResults';
import { Game } from '@/types/game';
import { useTheme } from '@/hooks/useTheme';
import Toast from 'react-native-toast-message';

type TabType = 'all' | 'created' | 'other';

// Extend Poll type locally for voteCount
interface PollWithVoteCount extends Poll {
  voteCount: number;
}

// Profile type for creator information
interface Profile {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
}

export default function PollsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const [polls, setPolls] = useState<PollWithVoteCount[]>([]);

  // Use fallback values for web platform
  const [allPolls, setAllPolls] = useState<PollWithVoteCount[]>([]);
  const [otherUsersPolls, setOtherUsersPolls] = useState<PollWithVoteCount[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [pollToEdit, setPollToEdit] = useState<Poll | null>(null);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [showShareLink, setShowShareLink] = useState<string | null>(null);
  const [showCopiedConfirmation, setShowCopiedConfirmation] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openResultsPollId, setOpenResultsPollId] = useState<string | null>(null);
  const [newVotes, setNewVotes] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const [preselectedGames, setPreselectedGames] = useState<Game[] | null>(null);

  // Memoize the loadPolls function to prevent unnecessary re-creations
  const loadPolls = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth/login');
        return;
      }
      setCurrentUserId(user.id);

      // Load all game polls (polls with associated games, not events)
      const { data: allPollsData, error: allPollsError } = await supabase
        .from('polls')
        .select(`
          *,
          poll_games!inner(
            id,
            game_id
          )
        `)
        .order('created_at', { ascending: false });

      if (allPollsError) throw allPollsError;

      // Fetch vote counts for all poll IDs using aggregate
      const pollIds = (allPollsData || []).map(p => p.id);
      let voterCountMap: Record<string, number> = {};
      if (pollIds.length > 0) {
        const { data: numberOfVoters, error: numberOfVotersError } = await supabase
          .from('votes')
          .select('poll_id, user_id, voter_name');
        if (!numberOfVotersError && numberOfVoters) {
          const pollVoters: Record<string, Set<string>> = {};
          numberOfVoters.forEach((row: any) => {
            if (row.poll_id && (row.user_id || row.voter_name)) {
              if (!pollVoters[row.poll_id]) pollVoters[row.poll_id] = new Set();
              pollVoters[row.poll_id].add(row.user_id || row.voter_name);
            }
          });
          Object.keys(pollVoters).forEach(pid => {
            voterCountMap[pid] = pollVoters[pid].size;
          });
        }
      }

      // Fetch creator profiles for all unique user_ids
      const userIds = Array.from(new Set((allPollsData || []).map(p => p.user_id)));
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

      setAllPolls([]); // will be set below

      // Separate created polls and other users' polls
      const createdPolls = allPollsData?.filter(poll => poll.user_id === user.id) || [];

      // Get polls from other users that the current user has voted in
      const { data: userVotes, error: votesError } = await supabase
        .from('votes')
        .select('poll_id')
        .eq('user_id', user.id);

      if (votesError) throw votesError;

      let otherUsersPolls: Poll[] = [];
      if (userVotes && userVotes.length > 0) {
        const votedPollIds = [...new Set(userVotes.map(vote => vote.poll_id))];
        otherUsersPolls = allPollsData?.filter(poll =>
          poll.user_id !== user.id && votedPollIds.includes(poll.id)
        ) || [];
      }

      // Add voterCount to each poll
      const addVoterCount = (polls: Poll[]): PollWithVoteCount[] =>
        polls.map(p => ({ ...p, voteCount: voterCountMap[p.id] || 0 }));

      setPolls(addVoterCount(createdPolls));
      setOtherUsersPolls(addVoterCount(otherUsersPolls));

      // Set allPolls to be the union of createdPolls and otherUsersPolls (no duplicates)
      const uniqueAllPolls: PollWithVoteCount[] = [
        ...addVoterCount(createdPolls),
        ...addVoterCount(otherUsersPolls.filter(
          (poll) => !createdPolls.some((myPoll) => myPoll.id === poll.id)
        )),
      ];
      // Sort by created_at to ensure proper date ordering
      uniqueAllPolls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAllPolls(uniqueAllPolls);
    } catch (err) {
      console.error('Error loading polls:', err);
      setError(err instanceof Error ? err.message : 'Failed to load polls');
    } finally {
      setLoading(false);
      // Reset newVotes when polls are refreshed
      setNewVotes(false);
    }
  }, [router]);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  // Handle refresh parameter from URL
  useEffect(() => {
    if (params.refresh === 'true') {
      loadPolls();
      // Clear the refresh parameter from URL
      router.setParams({ refresh: undefined });
    }
  }, [params.refresh, loadPolls, router]);

  // Auto-switch to 'all' tab if 'other' tab has no polls
  useEffect(() => {
    if (activeTab === 'other' && otherUsersPolls.length === 0) {
      setActiveTab('all');
    }
  }, [activeTab, otherUsersPolls.length]);

  // --- Real-time vote listening subscription ---
  useEffect(() => {
    // Subscribe to new votes for any poll
    const channel = supabase
      .channel('votes-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'votes',
        },
        (payload) => {
          setNewVotes(true);
        }
      )
      .subscribe();
    subscriptionRef.current = channel;
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);

  // Show toast when new votes arrive
  useEffect(() => {
    if (newVotes) {
      Toast.show({ type: "info", text1: 'New votes received', text2: 'Refresh to update' });
      setNewVotes(false);
    }
  }, [newVotes]);

  // Removed scaled styling helper for simplicity and HIG clarity

  // Memoize current polls to prevent unnecessary re-renders
  const currentPolls = useMemo(() => {
    return activeTab === 'all' ? allPolls : activeTab === 'created' ? polls : otherUsersPolls;
  }, [activeTab, allPolls, polls, otherUsersPolls]);

  const handleShare = useCallback(async (pollId: string) => {
    // Use a proper base URL for React Native
    const baseUrl = Platform.select({
      web: typeof window !== 'undefined' ? window.location.origin : 'https://klack.netlify.app',
      default: 'https://klack.netlify.app', // Replace with your actual domain
    });

    const shareUrl = `${baseUrl}/poll/${pollId}`;
    setShowShareLink(shareUrl);

    try {
      if (Platform.OS === 'web') {
        // Web-specific sharing
        if (navigator.share) {
          await navigator.share({
            title: 'Vote on which game to play!',
            text: 'Help us decide which game to play by voting in this poll.',
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
        announceForAccessibility('Poll link copied to clipboard');
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
        announceForAccessibility('Poll link copied to clipboard');
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
    if (!pollToDelete) return;

    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollToDelete.id);

      if (error) throw error;

      setPollToDelete(null);
      await loadPolls();
      announceForAccessibility('Poll deleted successfully');
    } catch (err) {
      console.error('Error deleting poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete poll');
    }
  }, [pollToDelete, loadPolls]);

  const handleEditPoll = useCallback((poll: Poll) => {
    setPollToEdit(poll);
    setEditModalVisible(true);
  }, []);

  // Helper to render poll results dropdown - memoized to prevent unnecessary re-renders
  const PollResultsDropdown = useCallback(({ pollId }: { pollId: string }) => {
    const { results, loading, error } = usePollResults(pollId);
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={() => { }} />;
    if (!results || results.length === 0) return <Text style={styles.noVotesText}>No votes yet.</Text>;

    // Transform the data to match PollScreenCard's expected format
    const transformedGames = results.map(result => {
      const transformedGame = { ...result.game } as any;

      // Flatten the nested votes structure using forEach
      if (result.game.votes?.votes) {
        Object.entries(result.game.votes.votes).forEach(([voteType, count]) => {
          transformedGame[voteType] = count || 0;
        });
      }

      return transformedGame;
    });

    return (
      <PollScreenCard
        games={transformedGames}
        onViewDetails={() => router.push({ pathname: '/poll/[id]/results', params: { id: pollId } })}
      />
    );
  }, [router]);

  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadPolls} />;
  }

  const isCreator = activeTab === 'created';
  // userId is managed by useState and set in useEffect

  return (
    <View style={styles.container}>
      {currentPolls.length > 0 && (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setCreateModalVisible(true)}
          >
            <SFSymbolIcon name="plus" color="#ffffff" />
            <Text style={styles.createButtonText}>Create Poll</Text>
          </TouchableOpacity>
          <View style={styles.tabsWrapper}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'all' && styles.activeTab]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
                  All Polls ({allPolls.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'created' && styles.activeTab]}
                onPress={() => setActiveTab('created')}
              >
                <Text style={[styles.tabText, activeTab === 'created' && styles.activeTabText]}>
                  My Polls ({polls.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'other' && styles.activeTab,
                  otherUsersPolls.length === 0 && styles.disabledTab
                ]}
                onPress={() => otherUsersPolls.length > 0 && setActiveTab('other')}
                disabled={otherUsersPolls.length === 0}
              >
                <Text style={[
                  styles.tabText,
                  activeTab === 'other' && styles.activeTabText,
                  otherUsersPolls.length === 0 && styles.disabledTabText
                ]}>
                  Voted In ({otherUsersPolls.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}



      {showShareLink && (
        <View style={styles.shareLinkContainer} accessibilityLabel="Share link panel" accessibilityRole="summary">
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
              accessibilityHint="Copies the poll link to your clipboard"
              hitSlop={touchTargets.small}
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(showShareLink || '');
                  setShowCopiedConfirmation(true);
                  setTimeout(() => setShowCopiedConfirmation(false), 2000);
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
        data={currentPolls}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isDropdownOpen = openResultsPollId === item.id;
          return (
            <View style={styles.pollCard}>
              <View style={styles.pollHeaderRow}>
                <Pressable
                  style={({ hovered }) => [
                    styles.pollTitleContainer,
                    hovered && Platform.OS === 'web' ? styles.pollTitleContainerHover : null,
                  ]}
                  accessibilityLabel={`Open poll ${item.title}`}
                  accessibilityRole="link"
                  accessibilityHint="Opens the poll details"
                  onPress={() => router.push({ pathname: '/poll/[id]', params: { id: item.id } })}
                >
                  <View style={styles.titleRow}>
                    <Text style={[styles.pollTitle, styles.pollTitleLink]} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.titleMetaRow}>
                      <View style={styles.titleCalendarIcon}>
                        <SFSymbolIcon name="calendar" size={16} color={colors.textMuted} />
                      </View>
                      <Text style={styles.pollDateInline} numberOfLines={1}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {item.description && (
                    <Text style={styles.pollDescription}>{item.description}</Text>
                  )}
                </Pressable>
                <View style={styles.actionsRightColumn}>
                  {item.user_id === currentUserId && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      hitSlop={touchTargets.small}
                      accessibilityLabel={`Delete poll ${item.title}`}
                      accessibilityRole="button"
                      accessibilityHint="Permanently deletes this poll"
                      onPress={() => setPollToDelete(item)}
                    >
                      <SFSymbolIcon name="x" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {/* Unified action row with wrap */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.shareButton} onPress={() => handleShare(item.id)}
                  accessibilityLabel={`Share poll ${item.title}`}
                  accessibilityRole="button"
                  accessibilityHint="Shares the poll link">
                  <SFSymbolIcon name="share2" />
                  <Text style={styles.shareLinkButtonText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.localVoteButton} onPress={() => router.push(`/poll/local/${item.id}`)}
                  accessibilityLabel={`In-Person voting for ${item.title}`}
                  accessibilityRole="button"
                  accessibilityHint="Opens local in-person voting">
                  <SFSymbolIcon name="users" />
                  <Text style={styles.localVoteButtonText}>Local</Text>
                </TouchableOpacity>

                {item.user_id === currentUserId && (
                  <TouchableOpacity
                    style={styles.editButton}
                    accessibilityLabel={`Edit poll ${item.title}`}
                    accessibilityRole="button"
                    accessibilityHint="Edits this poll"
                    onPress={() => handleEditPoll(item)}
                  >
                    <SFSymbolIcon name="edit" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[styles.resultsButton, item.voteCount === 0 && styles.resultsButtonDisabled]}
                accessibilityLabel={`View results for ${item.title}`}
                accessibilityRole="button"
                accessibilityHint="Shows voting results for this poll"
                onPress={() => setOpenResultsPollId(isDropdownOpen ? null : item.id)}
                disabled={item.voteCount === 0}
              >
                <SFSymbolIcon name="barchart3" />
                <Text style={[styles.resultsButtonText, item.voteCount === 0 && styles.resultsButtonTextDisabled]}>
                  View Results ({item.voteCount})
                </Text>
              </TouchableOpacity>

              {/* Dropdown below poll card */}
              {isDropdownOpen && (
                <View style={styles.dropdownContainer}>
                  <PollResultsDropdown pollId={item.id} />
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          currentPolls.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={
          <EmptyStatePolls onCreate={() => setCreateModalVisible(true)} />
        }
      />

      <CreatePollModal
        isVisible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setPreselectedGames(null);
        }}
        onSuccess={() => {
          setCreateModalVisible(false);
          setPreselectedGames(null);
          loadPolls();
        }}
        preselectedGames={preselectedGames || undefined}
      />

      <EditPollModal
        isVisible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setPollToEdit(null);
        }}
        onSuccess={() => {
          setEditModalVisible(false);
          setPollToEdit(null);
          loadPolls();
        }}
        pollId={pollToEdit?.id || ''}
        pollTitle={pollToEdit?.title || ''}
        pollDescription={pollToEdit?.description}
      />

      <ConfirmationDialog
        isVisible={pollToDelete !== null}
        title="Delete Poll"
        message={`Are you sure you want to delete "${pollToDelete?.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setPollToDelete(null)}
      />
    </View>
  );
}

const getStyles = (colors: any, typography: any) => {
  const accentTint = colors.tints.accent;
  const primaryTint = colors.tints.primary;
  const successTint = colors.tints.success;
  const neutralTint = colors.tints.neutral;
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
    emptyListContent: {
      flex: 1,
      justifyContent: 'center',
      paddingTop: 40,
      paddingHorizontal: 20,
    },
    listContent: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 60, // Base padding for tab bar
    },
    pollCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      marginHorizontal: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    pollMainRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      width: '100%',
    },
    pollHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    pollTitleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    pollTitleContainerHover: {
      backgroundColor: colors.background,
    },
    pollTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.primary,
      marginBottom: 4,
      paddingTop: 8, // Add padding to shift title down
    },
    pollTitleLink: {
      textDecorationLine: 'underline',
      marginBottom: 0,
      flexShrink: 1,
      color: colors.primary,
      fontSize: 18,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    titleMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 12,
    },
    titleCalendarIcon: {
      paddingTop: 8,
      marginBottom: 0,
      marginRight: 4,
    },
    pollDateInline: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      paddingTop: 8,
      marginBottom: 0,
    },
    pollDescription: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      marginBottom: 8,
    },
    actionsRightColumn: {
      alignItems: 'flex-end',
      minWidth: 40,
    },
    pollDate: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
    },
    pollActions: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-end',
      marginTop: 0,
    },
    deleteButton: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      borderRadius: 12,
      backgroundColor: errorTint,
      marginLeft: 8,
    },
    shareButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: accentTint,
      borderRadius: 10,
      padding: 8,
      minHeight: 44,
      flex: 1,
      marginRight: 8,
      marginBottom: 8,
    },
    resultsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primaryTint,
      borderRadius: 10,
      minHeight: 44,
      padding: 8,
      minWidth: 110,
      flexShrink: 1,
      marginRight: 8,
      marginBottom: 8,
      width: '100%',
    },
    resultsButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.primary,
      marginLeft: 4,
    },
    resultsButtonDisabled: {
      backgroundColor: colors.border,
    },
    resultsButtonTextDisabled: {
      color: colors.textMuted,
    },
    localVoteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: successTint,
      padding: 8,
      borderRadius: 10,
      minHeight: 44,
      flex: 1,
      marginRight: 8,
      marginBottom: 8,
    },
    localVoteButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.success,
    },
    shareLinkButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.accent,
      marginLeft: 4,
    },
    voteCountBadge: {
      marginLeft: 8,
      backgroundColor: neutralTint,
      borderRadius: 999,
      minWidth: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    voteCountText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.primary,
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 18,
    },
    iconRight: {
      marginRight: 8,
    },
    dropdownContainer: {
      marginTop: 8,
    },
    noVotesText: {
      padding: 16,
      color: colors.textMuted,
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      textAlign: 'center',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: neutralTint,
      borderRadius: 10,
      minHeight: 44,
      padding: 8,
      flex: 1,
      marginRight: 8,
      marginBottom: 8,
    },
    editButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
    },
    responseCountBadge: {
      backgroundColor: neutralTint,
      borderRadius: 999,
      minWidth: 28,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    responseCountText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.primary,
    },

  });
};