import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking, ScrollView, ActivityIndicator } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import Animated, { FadeOut } from 'react-native-reanimated';
import { supabase } from '@/services/supabase';
import { decode } from 'html-entities';

import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

import { Game, Expansion } from '@/types/game';

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
  return 'N/A';
}

interface GameItemProps {
  game: Game;
  onDelete: (id: number) => void;
  onExpansionUpdate?: () => void;
}

export const GameItem: React.FC<GameItemProps> = ({ game, onDelete, onExpansionUpdate }) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUnownedExpansions, setShowUnownedExpansions] = useState(false);
  const [updatingExpansion, setUpdatingExpansion] = useState<number | null>(null);

  const styles = getStyles(colors, typography);

  const toggleExpanded = () => {
    setIsExpanded(currentIsExpanded => {
      const newExpanded = !currentIsExpanded;
      announceForAccessibility(newExpanded ? 'Game details expanded' : 'Game details collapsed');
      return newExpanded;
    });
  };

  const handleExpansionToggle = async (expansion: Expansion) => {
    try {
      setUpdatingExpansion(expansion.id);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (expansion.is_owned) {
        // Remove expansion from collection
        const { error } = await supabase
          .from('collections')
          .delete()
          .eq('bgg_game_id', expansion.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add expansion to collection
        const { error: insertError } = await supabase
          .from('collections')
          .insert({
            user_id: user.id,
            bgg_game_id: expansion.id,
            name: expansion.name,
            min_players: expansion.min_players,
            max_players: expansion.max_players,
            thumbnail: expansion.thumbnail,
          });
        if (insertError) throw insertError;
      }

      // Call the callback to refresh the collection
      onExpansionUpdate?.();
    } catch (err) {
      console.error('Error updating expansion:', err);
    } finally {
      setUpdatingExpansion(null);
    }
  };

  const useMinExpPlayers = game.min_exp_players && game.min_exp_players < game.min_players;
  const useMaxExpPlayers = game.max_exp_players > game.max_players;
  const minPlayers = useMinExpPlayers ? game.min_exp_players : game.min_players;
  const maxPlayers = useMaxExpPlayers ? game.max_exp_players : game.max_players;

  const hasMin = !!minPlayers && minPlayers > 0;
  const hasMax = !!maxPlayers && maxPlayers > 0;

  const playerCountText = (
    hasMin && hasMax ? (
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
          {` player${(hasMax ? maxPlayers : minPlayers) === 1 ? '' : 's'}`}
        </Text>
      </>
    ) : hasMin ? (
      <>
        <Text style={useMinExpPlayers ? styles.infoTextEmphasis : null}>
          {minPlayers}+
        </Text>
        <Text> players</Text>
      </>
    ) : hasMax ? (
      <>
        <Text>Up to </Text>
        <Text style={useMaxExpPlayers ? styles.infoTextEmphasis : null}>
          {maxPlayers}
        </Text>
        <Text>{` player${maxPlayers === 1 ? '' : 's'}`}</Text>
      </>
    ) : (
      'N/A'
    )
  );

  const ownedExpansionCount = game.expansions.filter((exp: Expansion) => exp.is_owned).length
  const ownedExpansionText = game.expansions.length > 0 ?
    `${ownedExpansionCount} of ${game.expansions.length} expansion${game.expansions.length > 1 ? 's' : ''} owned`
    : 'No expansions available'

  const expansionItems = game.expansions && game.expansions
    .filter((exp: Expansion) => exp.is_owned || showUnownedExpansions)
    .map((exp: Expansion) =>
      <View
        key={exp.id}
        style={styles.expansionItem}
      >
        <TouchableOpacity
          style={[
            styles.expansionButton,
            exp.is_owned ? styles.removeButton : styles.addButton
          ]}
          hitSlop={touchTargets.small}
          onPress={() => handleExpansionToggle(exp)}
          disabled={updatingExpansion === exp.id}
          accessibilityLabel={exp.is_owned ? "Remove expansion" : "Add expansion"}
          accessibilityRole="button"
          accessibilityHint={exp.is_owned ? "Remove this expansion from your collection" : "Add this expansion to your collection"}
        >
          {updatingExpansion === exp.id ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : exp.is_owned ? (
            <SFSymbolIcon name="minus" />
          ) : (
            <SFSymbolIcon name="plus" />
          )}
        </TouchableOpacity>
        <Text
          style={exp.is_owned ?
            styles.infoTextEmphasis
            : styles.infoText
          }
        >
          {decode(exp.name)}
        </Text>
      </View>
    );
  const expansionList = (
    <View style={[
      //styles.detailContainer,
      styles.infoText,
    ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={null}
      >
        <Text style={styles.infoTextEmphasis}>
          {ownedExpansionText}
        </Text>
        {ownedExpansionCount !== game.expansions.length &&
          <TouchableOpacity
            style={styles.expButton}
            onPress={() => setShowUnownedExpansions(currentShow => !currentShow)}
          >
            <Text style={styles.expButtonText}>
              {`${showUnownedExpansions ? 'Hide' : 'Show'} unowned`}
            </Text>
          </TouchableOpacity>
        }
      </ScrollView>
      {expansionItems.length > 0 &&
        <View style={styles.expansionList}>
          {expansionItems}
        </View>
      }
    </View>
  );

  return (
    <Animated.View
      style={styles.container}
      exiting={FadeOut.duration(200)}
    >
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(game.id)}
        hitSlop={touchTargets.small}
        accessibilityLabel="Delete game"
        accessibilityRole="button"
        accessibilityHint="Remove this game from your collection"
      >
        <SFSymbolIcon name="x" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.mainContent}
        onPress={toggleExpanded}
        activeOpacity={0.85}
        accessibilityLabel={isExpanded ? "Collapse game details" : "Expand game details"}
        accessibilityRole="button"
        accessibilityHint="Tap to view more information about this game"
      >
        <Image
          source={{ uri: game.thumbnail }}
          style={styles.thumbnail}
          resizeMode="cover"
        />

        <View style={styles.contentContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {decode(game.name)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <SFSymbolIcon name="users" />
              <Text style={styles.infoText}>
                {playerCountText}
              </Text>
            </View>
          </View>

          <View style={styles.infoRowWithMargin}>
            <View style={styles.infoItem}>
              <SFSymbolIcon name="clock" />
              <Text style={styles.infoText}>
                {getPlayTimeDisplay(game)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.chevronContainer}>
          <Text style={styles.infoText}>Info</Text>
          {isExpanded ? (
            <SFSymbolIcon name="chevron-down" />
          ) : (
            <SFSymbolIcon name="chevron-right" />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <SFSymbolIcon name="calendar" />
                <Text style={styles.detailLabel}>Publication Year</Text>
                <Text style={styles.detailValue}>
                  {game.yearPublished ? (game.yearPublished >= 0 ? game.yearPublished : -game.yearPublished + ' BCE') : 'N/A'}
                </Text>
              </View>

              <View style={styles.detailItem}>
                <SFSymbolIcon name="brain" />
                <Text style={styles.detailLabel}>Weight</Text>
                <Text style={styles.detailValue}>
                  {game.complexity ?
                    `${game.complexity.toFixed(1)}${game.complexity_desc ? ` (${game.complexity_desc})` : ''}`
                    : 'N/A'}
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
                  {game.minAge ? `${game.minAge}` : 'N/A'}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <TouchableOpacity
                style={styles.bggButton}
                onPress={() => Linking.openURL(`https://boardgamegeek.com/boardgame/${game.id}/`)}
                activeOpacity={0.7}
              >
                <Text style={styles.bggButtonText}>
                  View on BGG
                </Text>
              </TouchableOpacity>
            </View>

            {expansionList}

          </View>
        </View>
      )}
    </Animated.View>
  );
};

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    backgroundColor: colors.error + '20', // 20% opacity
    borderRadius: 12,
    padding: 4,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  contentContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginBottom: 4,
    marginTop: -8,
  },
  title: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.text,
    flex: 1,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  chevronContainer: {
    marginLeft: 'auto',
    marginRight: -5,
    marginTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  expandIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  infoRowWithMargin: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 2,
    marginTop: 4,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
    marginLeft: 4,
  },
  infoTextEmphasis: {
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.text,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsContainer: {
    // gap replaced with marginBottom on detailRow
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
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
    fontSize: typography.fontSize.footnote,
    color: colors.text,
    marginTop: 2,
    textAlign: 'center',
  },
  expButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    //paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  expButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.footnote,
    color: colors.accent,
  },
  bggButton: {
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  bggButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.footnote,
    color: colors.accent,
    textAlign: 'center',
  },
  expansionList: {
    paddingLeft: 10,
    marginTop: 8,
  },
  expansionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginVertical: 2,
    backgroundColor: colors.border,
    borderRadius: 6,
  },
  expansionButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  addButton: {
    backgroundColor: colors.success + '20', // 20% opacity
    borderWidth: 1,
    borderColor: colors.success,
  },
  removeButton: {
    backgroundColor: colors.error + '20', // 20% opacity
    borderWidth: 1,
    borderColor: colors.error,
  },
});