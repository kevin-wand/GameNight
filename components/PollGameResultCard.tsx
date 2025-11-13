import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { VOTING_OPTIONS, ICON_MAP, SCORE_TO_VOTE_TYPE, getVoteTypeKeyFromScore, getIconColor, getVoteBgColor } from './votingOptions';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useMemo } from 'react';
import { Game } from '@/types/game';
import { decode } from 'html-entities';

interface GameVotes {
  votes: Record<string, number>; // voteType1: 3, voteType2: 1, etc.
  voters: { name: string; vote_type: number }[];
}

interface PollGame extends Game {
  votes: GameVotes;
  userVote?: number | null;
}

// Use centralized helper via votingOptions with theme tokens

export function GameResultCard({ game }: { game: PollGame }) {
  const decodedName = decode(game.name);
  const { colors, typography } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);
  const [showVoters, setShowVoters] = useState(false);

  // Ensure game.votes exists
  if (!game.votes) {
    console.warn('Game votes is undefined for game:', game.id);
    return (
      <View style={styles.card}>
        <Text style={styles.name}>{decodedName}</Text>
        <Text style={styles.errorText}>Vote data unavailable</Text>
      </View>
    );
  }

  // Calculate total votes using array manipulation
  const totalVotes = Object.values(game.votes.votes).reduce((sum, count) => sum + count, 0);

  // Group voters by their vote type
  const getVotersByType = () => {
    const votersByType: Record<string, string[]> = {};
    VOTING_OPTIONS.forEach(opt => { votersByType[opt.value] = []; });

    if (game.votes.voters && Array.isArray(game.votes.voters)) {
      game.votes.voters.forEach(voter => {
        const voteTypeKey = getVoteTypeKeyFromScore(voter.vote_type);
        if (votersByType[voteTypeKey]) {
          votersByType[voteTypeKey].push(voter.name);
        }
      });
    }
    return votersByType;
  };
  const votersByType = getVotersByType();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.name}>{decodedName}</Text>
      </View>
      <View style={styles.votesContainer}>
        {VOTING_OPTIONS.map(function (option: typeof VOTING_OPTIONS[number]) {
          const score = option.score; // Get the score from the option for coloring
          const voteTypeKey = getVoteTypeKeyFromScore(option.score);
          const voteCount = game.votes.votes[voteTypeKey] || 0;
          return (
            <View style={styles.voteItem} key={option.value}>
              <View style={styles.voteIconContainer}>
                {(() => {
                  // Use ICON_MAP from votingOptions
                  const IconComponent = ICON_MAP[option.icon];

                  // Check if IconComponent is a valid React component (can be function or object with render method)
                  if (IconComponent && (typeof IconComponent === 'function' || typeof IconComponent === 'object')) {
                    return <IconComponent size={24} color={getIconColor(option.value, false, colors)} />;
                  }

                  // Return null if no icon found
                  return null;
                })()}
                <Text style={[styles.voteCount, { backgroundColor: getVoteBgColor(score, true, colors) }]}>{voteCount}</Text>
              </View>
              <Text style={styles.voteLabel}>{option.label}</Text>
            </View>
          );
        })}
      </View>
      {totalVotes > 0 && (
        <View style={styles.votersSection}>
          <TouchableOpacity
            style={styles.showVotersButton}
            onPress={() => {
              setShowVoters(!showVoters);
              announceForAccessibility(showVoters ? 'Voters list hidden' : 'Voters list shown');
            }}
            accessibilityRole="button"
            accessibilityLabel={showVoters ? 'Hide voters list' : 'Show voters list'}
            accessibilityHint="Toggles display of voter names for each vote type"
          >
            <Text style={styles.showVotersText}>
              {showVoters ? 'Hide Voters' : 'Show Voters'}
            </Text>
            {showVoters ? (
              <SFSymbolIcon name="chevron-up" />
            ) : (
              <SFSymbolIcon name="chevron-down" />
            )}
          </TouchableOpacity>
          {showVoters && (
            <View style={styles.votersDetails}>
              {VOTING_OPTIONS.map(option => (
                votersByType[option.value]?.length > 0 && (
                  <View style={styles.voteTypeSection} key={option.value}>
                    <View style={styles.voteTypeHeader}>
                      {(() => {
                        const IconComponent = ICON_MAP[option.icon];
                        if (IconComponent && (typeof IconComponent === 'function' || typeof IconComponent === 'object')) {
                          return <IconComponent size={16} color={getIconColor(option.value, false, colors)} />;
                        }
                        return null;
                      })()}
                      <Text style={[styles.voteTypeLabel]}>
                        {option.label} ({votersByType[option.value].length})
                      </Text>
                    </View>
                    <Text style={styles.votersList}>
                      {votersByType[option.value].join(', ')}
                    </Text>
                  </View>
                )
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.primary,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title3,
    flex: 1,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tints.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalScore: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.callout,
    color: colors.accent,
    marginLeft: 4,
  },
  votesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
  },
  voteItem: {
    alignItems: 'center',
    flex: 1,
  },
  voteIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  voteCount: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.callout,
    marginTop: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 28,
    textAlign: 'center',
  },
  voteLabel: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  votersSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  showVotersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.tints.accent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    minHeight: 44,
  },
  showVotersText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.accent,
    marginRight: 4,
  },
  votersDetails: {
    marginTop: 12,
  },
  voteTypeSection: {
    marginBottom: 12,
  },
  voteTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voteTypeLabel: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.primary,
    marginLeft: 6,
  },
  votersList: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.textMuted,
    lineHeight: typography.lineHeight.normal * typography.fontSize.subheadline,
    marginLeft: 22,
  },
  errorText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.error,
    textAlign: 'center',
    marginTop: 8,
  },
});