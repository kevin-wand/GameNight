import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useRouter } from 'expo-router';
import { AddGameModal } from '@/components/AddGameModal';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

interface EmptyStateCollectionProps {
  username: string | null;
  onRefresh: (username?: string) => void | Promise<void>;
  loadGames: () => void;
  message?: string;
  buttonText?: string;
  showSyncButton?: boolean;
  handleClearFilters: any;
}

export const EmptyStateCollection: React.FC<EmptyStateCollectionProps> = ({
  username,
  onRefresh,
  loadGames,
  message,
  buttonText = "Refresh",
  showSyncButton = false,
  handleClearFilters
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const [addGameModalVisible, setAddGameModalVisible] = useState(false);
  const router = useRouter();

  const styles = useMemo(() => getStyles(colors, typography, touchTargets), [colors, typography, touchTargets]);



  if (showSyncButton) {
    return (
      <View style={styles.container}>
        {/* Main heading */}
        <Text style={styles.title}>Add games to your collection!</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          Enable these benefits:
        </Text>

        {/* Benefits list */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <SFSymbolIcon name="star" />
            <Text style={styles.benefitText}>Track your collection</Text>
          </View>

          <View style={styles.benefitItem}>
            <SFSymbolIcon name="filter" />
            <Text style={styles.benefitText}>Easily filter to find the right game</Text>
          </View>

          <View style={styles.benefitItem}>
            <SFSymbolIcon name="users" />
            <Text style={styles.benefitText}>Let your friends vote on what they want to play</Text>
          </View>
        </View>

        {/* Add Game Button */}
        <TouchableOpacity
          style={styles.addGameButton}
          onPress={() => {
            setAddGameModalVisible(true);
            announceForAccessibility('Opening add game modal');
          }}
          activeOpacity={0.8}
          accessibilityLabel="Add games to your collection"
          accessibilityRole="button"
          accessibilityHint="Opens a modal to add games manually"
        >
          <SFSymbolIcon name="plus" />
          <Text style={styles.addGameButtonText}>Add Games</Text>
        </TouchableOpacity>


        <AddGameModal
          isVisible={addGameModalVisible}
          onClose={() => setAddGameModalVisible(false)}
          onGameAdded={loadGames}
        />
      </View>
    );
  }

  // Fallback for non-sync scenarios
  return (
    <View style={styles.container}>
      <Text style={styles.emptyTitle}>No Games Found</Text>
      <Text style={styles.emptyMessage}>
        {message || (username ?
          `We couldn't find any games in ${username}'s collection.` :
          'We couldn\'t find any games in your collection.'
        )}
      </Text>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => {
          handleClearFilters();
          announceForAccessibility('Filters cleared, showing all games');
        }}
        accessibilityLabel={buttonText}
        accessibilityRole="button"
        accessibilityHint="Clears current filters to show all games"
      >
        <SFSymbolIcon name="refresh" />
        <Text style={styles.refreshText}>{buttonText}</Text>
      </TouchableOpacity>

      <Text style={styles.helpText}>
        Make sure your BoardGameGeek collection contains board games.
      </Text>
    </View>
  );
};

const getStyles = (colors: any, typography: any, touchTargets: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 300,
    lineHeight: typography.lineHeight.body,
  },
  benefitsList: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 16,
    //borderColor: 'red',
    //borderWidth: 1,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  benefitText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.text,
    marginLeft: 12,
    flex: 1,
    lineHeight: typography.lineHeight.body,
  },
  addGameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    marginBottom: 16,
    minHeight: touchTargets.standard.height,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  addGameButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.card,
    marginLeft: 8,
  },
  helpText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption2,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: typography.lineHeight.caption2,
  },
  // Legacy styles for non-sync scenarios
  emptyTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyMessage: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
    lineHeight: typography.lineHeight.caption1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
    minHeight: touchTargets.standard.height,
  },
  refreshText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.card,
    marginLeft: 8,
  },
});