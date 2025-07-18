import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Share2, Trash2, X, Copy, Check, BarChart3, Users } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';

import { supabase } from '@/services/supabase';
import { Poll } from '@/types/poll';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { CreatePollModal } from '@/components/CreatePollModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { PollsEmptyState } from '@/components/PollsEmptyState';

type TabType = 'all' | 'created' | 'other';

export default function PollsScreen() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [allPolls, setAllPolls] = useState<Poll[]>([]);
  const [otherUsersPolls, setOtherUsersPolls] = useState<Poll[]>([]);
  const [creatorMap, setCreatorMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
  const [showShareLink, setShowShareLink] = useState<string | null>(null);
  const [showCopiedConfirmation, setShowCopiedConfirmation] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadPolls();
    // Fetch and store the current user's id for later use
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    })();
  }, []);

  const loadPolls = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth/login');
        return;
      }

      // Load all polls
      const { data: allPollsData, error: allPollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false });

      if (allPollsError) throw allPollsError;

      // Fetch creator usernames/emails for all unique user_ids
      const userIds = Array.from(new Set((allPollsData || []).map(p => p.user_id)));
      let creatorMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, email')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach((profile: any) => {
            creatorMap[profile.id] = profile.email || profile.username || profile.id;
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
        .select('poll_id, voter_name')
        .eq('voter_name', user.email || 'Anonymous');

      if (votesError) throw votesError;

      let otherUsersPolls: Poll[] = [];
      if (userVotes && userVotes.length > 0) {
        const votedPollIds = [...new Set(userVotes.map(vote => vote.poll_id))];
        otherUsersPolls = allPollsData?.filter(poll =>
          poll.user_id !== user.id && votedPollIds.includes(poll.id)
        ) || [];
      }

      setPolls(createdPolls);
      setOtherUsersPolls(otherUsersPolls);

      // Set allPolls to be the union of createdPolls and otherUsersPolls (no duplicates)
      const uniqueAllPolls = [
        ...createdPolls,
        ...otherUsersPolls.filter(
          (poll) => !createdPolls.some((myPoll) => myPoll.id === poll.id)
        ),
      ];
      setAllPolls(uniqueAllPolls);
    } catch (err) {
      console.error('Error loading polls:', err);
      setError(err instanceof Error ? err.message : 'Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (pollId: string) => {
    // Use a proper base URL for React Native
    const baseUrl = Platform.select({
      web: typeof window !== 'undefined' ? window.location.origin : 'https://gamenyte.netlify.app',
      default: 'https://gamenyte.netlify.app', // Replace with your actual domain
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
        setTimeout(() => {
          setShowCopiedConfirmation(false);
        }, 2000);
      } catch (clipboardErr) {
        console.log('Error copying to clipboard:', clipboardErr);
        // Last resort: show the URL in an alert for manual copying
        alert(`Share this link: ${shareUrl}`);
      }
    }
  };

  const handleDelete = async () => {
    if (!pollToDelete) return;

    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', pollToDelete.id);

      if (error) throw error;

      setPolls(prevPolls => prevPolls.filter(poll => poll.id !== pollToDelete.id));
      setPollToDelete(null);
    } catch (err) {
      console.error('Error deleting poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete poll');
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadPolls} />;
  }

  const currentPolls = activeTab === 'all' ? allPolls : activeTab === 'created' ? polls : otherUsersPolls;
  const isCreator = activeTab === 'created';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
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
            style={[styles.tab, activeTab === 'other' && styles.activeTab]}
            onPress={() => setActiveTab('other')}
          >
            <Text style={[styles.tabText, activeTab === 'other' && styles.activeTabText]}>
              Voted In ({otherUsersPolls.length})
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setCreateModalVisible(true)}
        >
          <Plus size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>Create Poll</Text>
        </TouchableOpacity>
      </View>

      {showShareLink && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={styles.shareLinkContainer}
        >
          <View style={styles.shareLinkHeader}>
            <Text style={styles.shareLinkTitle}>Share Link</Text>
            <TouchableOpacity
              onPress={() => setShowShareLink(null)}
              style={styles.closeShareLinkButton}
            >
              <X size={20} color="#666666" />
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
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(showShareLink);
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
                <Check size={20} color="#4CAF50" />
              ) : (
                <Copy size={20} color="#ff9654" />
              )}
            </TouchableOpacity>
          </View>

          {showCopiedConfirmation && (
            <Text style={styles.copiedConfirmation}>Link copied to clipboard!</Text>
          )}
        </Animated.View>
      )}

      <FlatList
        data={currentPolls}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeIn.delay(index * 100)}
            style={styles.pollCard}
          >
            <View style={styles.pollMainRow}>
              <Pressable
                style={({ hovered }) => [
                  styles.pollTitleContainer,
                  hovered && Platform.OS === 'web' ? styles.pollTitleContainerHover : null,
                ]}
                onPress={() => router.push({ pathname: '/poll/[id]', params: { id: item.id } })}
              >
                <Text style={[styles.pollTitle, { textDecorationLine: 'underline', color: '#1a2b5f' }]}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.pollDescription}>{item.description}</Text>
                )}
                <Text style={styles.pollDate}>
                  Created on {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </Pressable>
              <View style={styles.pollActions}>
                {userId && item.user_id === userId && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => setPollToDelete(item)}
                  >
                    <Trash2 size={20} color="#e74c3c" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.localVoteButton}
                  onPress={() => router.push(`/poll/local/${item.id}`)}
                >
                  <Users size={20} color="#10b981" />
                  <Text style={styles.localVoteButtonText}>Local Vote</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShare(item.id)}
                >
                  <Share2 size={20} color="#ff9654" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resultsButton}
                  onPress={() => router.push({ pathname: '/poll/[id]/results', params: { id: item.id } })}
                >
                  <BarChart3 size={20} color="#4b5563" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <PollsEmptyState onCreate={() => setCreateModalVisible(true)} />
        }
      />

      <CreatePollModal
        isVisible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          loadPolls();
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fc',
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1a2b5f',
    fontFamily: 'Poppins-SemiBold',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9654',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  createButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#ffffff',
  },
  shareLinkContainer: {
    margin: 20,
    marginTop: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
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
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1a2b5f',
  },
  closeShareLinkButton: {
    padding: 4,
  },
  shareLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareLinkInput: {
    flex: 1,
    backgroundColor: '#f7f9fc',
    borderRadius: 8,
    padding: 12,
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#333333',
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#fff5ef',
    borderRadius: 8,
  },
  copiedConfirmation: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  pollCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pollMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  pollTitleContainer: {
    flexBasis: '50%',
    maxWidth: '50%',
    minWidth: 0,
    justifyContent: 'center',
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
    transitionProperty: Platform.OS === 'web' ? 'background' : undefined,
    transitionDuration: Platform.OS === 'web' ? '0.2s' : undefined,
  },
  pollTitleContainerHover: {
    backgroundColor: '#f3f4f6', // light highlight color
  },
  pollTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1a2b5f',
    marginBottom: 4,
  },
  pollDescription: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  pollDate: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#8d8d8d',
  },
  pollActions: {
    flexBasis: '50%',
    maxWidth: '50%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fff5f5',
    borderRadius: 8,
  },
  shareButton: {
    padding: 8,
    backgroundColor: '#fff5ef',
    borderRadius: 8,
  },
  resultsButton: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginLeft: 4,
  },
  localVoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    gap: 4,
  },
  localVoteButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#10b981',
  },
});