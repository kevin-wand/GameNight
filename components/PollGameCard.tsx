import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { VOTING_OPTIONS, ICON_MAP, VoteType, getIconColor, getVoteBgColor, getVoteBorderColor } from './votingOptions';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useMemo } from 'react';
import { decode } from 'html-entities';

// Helper function to get play time display with proper priority
function getPlayTimeDisplay(game: Game): string {
  // Priority 1: Show min-max range if both exist
  if (game.minPlaytime && game.maxPlaytime) {
    if (game.minPlaytime === game.maxPlaytime) {
      return `${game.minPlaytime} min`;
    }
    return `${game.minPlaytime}-${game.maxPlaytime} min`;
  }

  // Priority 2: Show individual min or max if only one exists
  if (game.minPlaytime || game.maxPlaytime) {
    return `${game.minPlaytime || game.maxPlaytime} min`;
  }

  // Priority 3: Fall back to playing_time if no min/max available
  if (game.playing_time) {
    return `${game.playing_time} min`;
  }

  // Default: No time information available
  return 'Unknown time';
}

// Utility to get score by voteType
const getScoreByVoteType = (voteType: string): number => {
  const option = VOTING_OPTIONS.find(opt => opt.value === voteType);
  return option ? option.score : 0;
};

interface Game {
  id: number;
  name: string;
  image_url: string;
  min_players: number;
  max_players: number;
  playing_time: number;
  minPlaytime: number;
  maxPlaytime: number;
  complexity?: number;
  complexity_desc?: string;
  bgg_id?: number;
  year_published?: number;
  thumbnail?: string;
  image?: string;
  average?: number | null;
  minAge?: number;
  min_exp_players: number;
  max_exp_players: number;
  // userVote property removed as it is not used
}

interface Props {
  game: Game;
  index: number;
  selectedVote?: string;
  onVote: (gameId: number, voteType: VoteType) => void;
  disabled?: boolean;
}

export const GameCard = ({ game, index, selectedVote, onVote, disabled }: Props) => {
  const decodedName = decode(game.name);
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);
  // Removed width-based responsiveness to rely on flexible layout per HIG

  const getButtonStyle = (voteType: string) => {
    const isSelected = selectedVote === voteType;
    const score = getScoreByVoteType(voteType);
    return [
      styles.voteButton,
      {
        backgroundColor: getVoteBgColor(score, isSelected, colors),
        borderColor: getVoteBorderColor(score, isSelected, colors),
        borderWidth: isSelected ? 3 : 2,
        shadowColor: isSelected ? getVoteBorderColor(score, isSelected, colors) : 'transparent',
        shadowOpacity: isSelected ? 0.25 : 0,
        shadowRadius: isSelected ? 8 : 0,
        elevation: isSelected ? 4 : 0,
      },
    ];
  };

  const [isExpanded, setIsExpanded] = React.useState(false);
  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  function hasRemovesGame(option: typeof VOTING_OPTIONS[number]): option is typeof VOTING_OPTIONS[number] & { removesGame: true } {
    return 'removesGame' in option && option.removesGame === true;
  }

  const useMinExpPlayers = game.min_exp_players && game.min_exp_players < game.min_players;
  const useMaxExpPlayers = game.max_exp_players > game.max_players;
  const minPlayers = useMinExpPlayers ? game.min_exp_players : game.min_players;
  const maxPlayers = useMaxExpPlayers ? game.max_exp_players : game.max_players;
  const playerCountText = (
    maxPlayers > 0
      ? (
        <>
          <Text style={useMinExpPlayers ? styles.infoTextEmphasis : null}>
            {minPlayers}
          </Text>
          {minPlayers !== maxPlayers && (
            <>
              <Text>-</Text>
              <Text style={useMaxExpPlayers ? styles.infoTextEmphasis : null}>
                {maxPlayers}
              </Text>
            </>
          )}
          <Text>
            {` player${maxPlayers === 1 ? '' : 's'}`}
          </Text>
        </>
      ) : (
        'N/A'
      )
  );

  return (
    <View style={styles.card}>
      {/* Two-column layout */}
      <View style={styles.mainContent}>
        {/* Left column: thumbnail, info button */}
        <View style={styles.leftColumn}>
          <Image
            source={{ uri: game.thumbnail || game.image || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg' }}
            style={styles.thumbnail}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${decodedName} thumbnail`}
          />
          <TouchableOpacity
            style={styles.leftInfoButton}
            onPress={toggleExpanded}
            accessibilityRole="button"
            accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} details for ${decodedName}`}
            accessibilityHint={isExpanded ? 'Hides game details' : 'Shows more information about the game'}
            hitSlop={touchTargets.small}
          >
            <Text style={styles.infoText}>Info</Text>
            {isExpanded ? (
              <SFSymbolIcon name="chevron-down" />
            ) : (
              <SFSymbolIcon name="chevron-right" />
            )}
          </TouchableOpacity>
        </View>

        {/* Right column: name row, detail row, vote buttons row */}
        <View style={styles.rightColumn}>
          {/* Row 1: Name */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{decodedName}</Text>
          </View>

          {/* Row 2: Details */}
          <View style={styles.detailsInfoRow}>
            <Text style={styles.details} numberOfLines={1} ellipsizeMode="tail">
              {playerCountText} • {getPlayTimeDisplay(game)}
            </Text>
          </View>

          {/* Row 3: Voting buttons */}
          <View style={styles.voteButtonsContainer}>
            {VOTING_OPTIONS.map(option => {
              const IconComponent = ICON_MAP[option.icon];
              return (
                <View key={option.value} style={styles.voteButtonWrapper}>
                  <TouchableOpacity
                    style={getButtonStyle(option.value)}
                    onPress={() => {
                      onVote(game.id, option.value);
                      announceForAccessibility(`Voted ${option.label} for ${decodedName}`);
                    }}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} for ${decodedName}`}
                    accessibilityHint={`Vote ${option.label.toLowerCase()} on ${decodedName}`}
                    hitSlop={touchTargets.vote}
                  >
                    <IconComponent size={20} color={getIconColor(option.value, selectedVote === option.value, colors)} />
                  </TouchableOpacity>
                  <Text style={styles.voteButtonLabel}>{option.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {isExpanded && (
        <View
          style={styles.expandedContent}
        >
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <LinkIcon size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>BGG Link</Text>
                <Text
                  style={[styles.detailValue, { color: colors.primary, textDecorationLine: 'underline' }]}
                  onPress={() => Linking.openURL(`https://boardgamegeek.com/boardgame/${game.id}`)}
                  accessibilityRole="link"
                  accessibilityLabel={`Open BoardGameGeek page for ${decodedName}`}
                  accessibilityHint="Opens in browser"
                >
                  More Info
                </Text>
              </View>
              <View style={styles.detailItem}>
                <SFSymbolIcon name="brain" />
                <Text style={styles.detailLabel}>Weight</Text>
                <Text style={styles.detailValue}>
                  {game.complexity ?
                    `${game.complexity.toFixed(1)}${game.complexity_desc ? ` (${game.complexity_desc})` : ''}`
                    : 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <SFSymbolIcon name="star" />
                <Text style={styles.detailLabel}>Community Score</Text>
                <Text style={styles.detailValue}>
                  {game.average ? game.average.toFixed(1) : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <SFSymbolIcon name="baby" />
                <Text style={styles.detailLabel}>Minimum Age</Text>
                <Text style={styles.detailValue}>
                  {game.minAge ? `${game.minAge}+` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  leftColumn: {
    width: 80,
    marginRight: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
  },
  gameInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    marginBottom: 2,
  },
  detailsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.tints.neutral,
    marginRight: 12,
  },
  infoText: {
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
    marginRight: 4,
  },

  infoTextEmphasis: {
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.primary,
  },
  name: {
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.primary,
    marginBottom: 4,
  },
  details: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
  },
  voteButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  voteButtonWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  voteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  voteButtonLabel: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption2,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },



  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsContainer: {
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.tints.neutral,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 16,
  },
  detailLabel: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  detailValue: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center',
  },
});