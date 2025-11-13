import React, { useState, useEffect, useMemo } from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { usePollResults } from '@/hooks/usePollResults';
import { GameResultCard } from '@/components/PollGameResultCard';
import { supabase } from '@/services/supabase';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import Toast from 'react-native-toast-message';
import { useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { censor } from '@/utils/profanityFilter';

export default function PollResultsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { colors, typography, touchTargets } = useTheme();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  // --- Real-time vote listening ---
  const [newVotes, setNewVotes] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const { poll, games, results, hasVoted, voteUpdated, creatorName, comments, loading, error, reload } = usePollResults(id);

  // Move useMemo before any early returns to follow Rules of Hooks
  const styles = useMemo(() => getStyles(colors, typography, insets), [colors, typography, insets]);


  useEffect(() => {
    if (!id) return;

    // Subscribe to new votes for this poll
    const channel = supabase
      .channel('votes-listener')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `poll_id=eq.${id}`,
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
  }, [id]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Check if user just updated their votes
    if (voteUpdated) {
      Toast.show({ type: 'success', text1: 'Vote updated!' });
    }
  }, [voteUpdated]);

  // Show toast when new votes arrive
  useEffect(() => {
    if (newVotes) {
      Toast.show({ type: "info", text1: 'New votes received', text2: 'Refresh to update' });
      setNewVotes(false);
    }
  }, [newVotes]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          router.replace({ pathname: '/poll/[id]', params: { id: id as string } });
        }}
      />
    );
  }

  // Ranking Icons are not in use. Can update with them if needed.
  const getRankingIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <SFSymbolIcon name="trophy" />; // Gold for 1st place
      case 2:
        return <SFSymbolIcon name="medal" />; // Silver for 2nd place
      case 3:
        return <SFSymbolIcon name="award" />; // Bronze for 3rd place
      default:
        return null;
    }
  };

  const getRankingColor = (rank: number) => {
    switch (rank) {
      case 1:
        return colors.warning; // Gold for 1st place
      case 2:
        return colors.textMuted; // Silver for 2nd place
      case 3:
        return colors.accent; // Bronze for 3rd place
      default:
        return colors.border; // Muted for other places
    }
  };

  const navigateToVoting = () => {
    router.push({ pathname: '/poll/[id]', params: { id: id as string } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/polls')}
          accessibilityLabel="Back to Polls"
          accessibilityRole="button"
          accessibilityHint="Returns to the polls list"
        >
          <Text style={styles.backLink}>&larr; Back to Polls</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Poll Results</Text>
        <Text style={styles.subtitle}>{poll?.title}</Text>
        <Text style={styles.subtitle}>Poll created by {creatorName}</Text>
      </View>


      {!user && (
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>
            Want to create your own polls?{' '}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/register')}
            accessibilityLabel="Sign up for free"
            accessibilityRole="button"
            accessibilityHint="Opens registration screen to create your own polls"
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
        {!results || results.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No votes have been cast yet.</Text>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Ranking Results</Text>
              <Text style={styles.resultsSubtitle}>
                {results.length} game{results.length !== 1 ? 's' : ''} ranked by votes
              </Text>
            </View>

            {results.map((result, index) => (
              <View key={result.game.id} style={styles.resultItem}>
                <View style={styles.rankingContainer}>
                  <View style={[styles.rankingBadge, { backgroundColor: getRankingColor(result.ranking) }]}>
                    <Text style={styles.rankingNumber}>{result.ranking}</Text>
                  </View>
                  <View style={styles.rankingInfo}>
                    <Text style={styles.rankingLabel}>
                      {`${result.ranking}${getOrdinalSuffix(result.ranking)} Place`}
                    </Text>
                    <Text style={styles.scoreText}>
                      {result.totalVotes} votes
                    </Text>
                  </View>
                </View>
                <GameResultCard game={result.game} />
              </View>
            ))}
            {/* Comments Section at the bottom of the scrollview */}
            {comments?.length > 0 && (
              <View style={styles.commentsContainer}>
                <Text style={styles.commentsTitle}>Comments</Text>
                {comments.map((c, idx) => (
                  <View key={idx} style={styles.commentItem}>
                    <Text style={styles.commentVoter}>{
                      c.username
                        ? (c.firstname || c.lastname
                          ? `${censor([c.firstname, c.lastname].join(' ').trim())} (${c.username})`
                          : c.username
                        ) : censor(c.voter_name) || 'Anonymous'
                    }:</Text>
                    <Text style={styles.commentText}>{c.comment_text}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomActionsContainer}>
        <TouchableOpacity
          style={styles.backToVotingButton}
          onPress={navigateToVoting}
          accessibilityLabel={hasVoted ? 'Back to Voting' : 'Vote Now'}
          accessibilityRole="button"
          accessibilityHint={hasVoted ? 'Returns to voting screen' : 'Opens voting screen to cast your vote'}
        >
          <SFSymbolIcon name="vote" />
          <Text style={styles.backToVotingButtonText}>
            {hasVoted ? 'Back to Voting' : 'Vote Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getOrdinalSuffix = (num: number) => {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
};

const getStyles = (colors: any, typography: any, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: insets.bottom + 20,
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
  },
  subtitle: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.card,
    opacity: 0.8,
  },
  resultsHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  resultsTitle: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.headline,
    color: colors.primary,
    marginTop: 6,
    marginBottom: 4,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title3,
  },
  resultsSubtitle: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.textMuted,
    //lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  resultItem: {
    marginBottom: 20,
  },
  rankingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  rankingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
    minWidth: 60,
    justifyContent: 'center',
  },
  rankingNumber: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.body,
    color: colors.card,
    marginLeft: 4,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  rankingInfo: {
    flex: 1,
  },
  rankingLabel: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.primary,
    marginBottom: 2,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  scoreText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.textMuted,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  signUpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  signUpLink: {
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.accent,
    marginLeft: 4,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  bottomActionsContainer: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Math.max(20, insets.bottom),
    width: '100%',
    alignSelf: 'stretch',
  },
  backToVotingButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 44,
  },
  backToVotingButtonText: {
    fontSize: typography.fontSize.body,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.card,
    marginLeft: 8,
  },
  commentsContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  commentsTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.primary,
    marginBottom: 8,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  commentItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentVoter: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.accent,
    marginBottom: 2,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  commentText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  backLink: {
    color: colors.accent,
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    marginBottom: 8,
    textDecorationLine: 'underline',
    alignSelf: 'flex-start',
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },

});


