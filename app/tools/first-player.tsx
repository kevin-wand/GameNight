import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useDeviceType } from '@/hooks/useDeviceType';
import ToolsFooter from '@/components/ToolsFooter';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';

export default function FirstPlayerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const { screenHeight } = useDeviceType();
  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // No shared values needed; animations are declarative on components

  const styles = useMemo(() => getStyles(colors, typography, touchTargets, insets), [colors, typography, touchTargets, insets]);

  const addPlayer = () => {
    if (newPlayer.trim() && !players.includes(newPlayer.trim())) {
      setPlayers([...players, newPlayer.trim()]);
      setNewPlayer('');
    }
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
    setSelectedPlayer(null);
  };

  const updateCountdown = useCallback((value: number | null) => {
    setCountdown(value);
  }, []);

  const finishSelection = useCallback((finalPlayer: string) => {
    setIsSelecting(false);
    setSelectedPlayer(finalPlayer);
    setCountdown(null);
    announceForAccessibility(`${finalPlayer} goes first!`);
  }, [announceForAccessibility]);

  const selectRandomPlayer = async () => {
    if (players.length > 0) {
      setIsSelecting(true);
      setSelectedPlayer(null);

      const finalIndex = Math.floor(Math.random() * players.length);
      const finalPlayer = players[finalIndex];

      // Start countdown with faster timing (700ms per number)
      for (let i = 3; i > 0; i--) {
        updateCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 700));
      }

      // Show the reveal animation slightly faster
      updateCountdown(null);
      setTimeout(() => {
        finishSelection(finalPlayer);
      }, 300);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: 'https://images.pexels.com/photos/278918/pexels-photo-278918.jpeg' }}
        style={styles.backgroundImage}
      />
      <View style={styles.overlay} />

      {countdown !== null && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={styles.countdownOverlay}
        >
          <Animated.Text
            entering={ZoomIn.duration(200)}
            exiting={ZoomOut.duration(200)}
            style={styles.countdownText}
          >
            {countdown}
          </Animated.Text>
        </Animated.View>
      )}

      {selectedPlayer && !isSelecting && (
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.revealOverlay}
        >
          <Animated.View
            entering={SlideInDown.duration(800).springify()}
            exiting={SlideOutUp.duration(300)}
            style={styles.revealCard}
          >
            <Text style={styles.revealText}>
              {selectedPlayer}
            </Text>
            <Text style={styles.revealSubtext}>
              goes first!
            </Text>
            <TouchableOpacity
              style={styles.closeRevealButton}
              onPress={() => setSelectedPlayer(null)}
              accessibilityLabel="Close results"
              accessibilityRole="button"
            >
              <Text style={styles.closeRevealText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      <View style={styles.header}>
        <Text style={styles.title}>Who's Going First?</Text>
        <Text style={styles.subtitle}>Add players and randomly select who starts</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newPlayer}
            onChangeText={setNewPlayer}
            placeholder="Enter player name"
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={addPlayer}
            maxLength={20}
            accessibilityLabel="Enter player name"
          />
          <TouchableOpacity
            style={[styles.addButton, !newPlayer.trim() && styles.addButtonDisabled]}
            onPress={() => addPlayer()}
            disabled={!newPlayer.trim()}
            accessibilityLabel="Add player"
            accessibilityRole="button"
          >
            <SFSymbolIcon name="plus" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={players}
          keyExtractor={(_, index) => index.toString()}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(300)}
              style={styles.playerItem}
            >
              <Text style={styles.playerName}>{item}</Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePlayer(index)}
                hitSlop={touchTargets.getHitSlop(28)}
                accessibilityLabel={`Remove ${item}`}
                accessibilityRole="button"
              >
                <SFSymbolIcon name="x" />
              </TouchableOpacity>
            </Animated.View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Add some players to get started
            </Text>
          }
        />

        {players.length > 1 && (
          <TouchableOpacity
            style={[styles.shuffleButton, isSelecting && styles.shuffleButtonDisabled]}
            onPress={selectRandomPlayer}
            disabled={isSelecting}
            accessibilityLabel="Select a random player"
            accessibilityRole="button"
          >
            <SFSymbolIcon name="shuffle" />
            <Text style={styles.shuffleText}>
              {isSelecting ? 'Selecting...' : 'Select Random Player'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.footerContainer}>
        <ToolsFooter currentScreen="tools" />
      </View>
    </View>
  );
}
function getStyles(colors: any, typography: any, touchTargets: any, insets: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backgroundImage: {
      position: 'absolute',
      width: '100%',
      height: 200,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 200,
      backgroundColor: colors.primary + 'D9',
    },
    header: {
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
      minHeight: 60,
      justifyContent: 'center',
    },
    title: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.headline,
      color: colors.card,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.card,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      padding: 20,
      paddingBottom: 60 + Math.max(8, Platform.OS === 'web' ? 0 : insets.bottom) + 20,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      paddingTop: 8,
      paddingHorizontal: 8,
    },
    input: {
      flex: 1,
      flexShrink: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    addButton: {
      width: Math.max(48, touchTargets.minSize),
      height: Math.max(48, touchTargets.minSize),
      backgroundColor: colors.accent,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    addButtonDisabled: {
      opacity: 0.7,
    },
    list: {
      flex: 1,
    },
    playerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    playerName: {
      flex: 1,
      fontSize: typography.fontSize.callout,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
    },
    removeButton: {
      width: 28,
      height: 28,
      backgroundColor: colors.tints.error,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyText: {
      textAlign: 'center',
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
      marginTop: 32,
    },
    shuffleButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      minHeight: 44,
    },
    shuffleButtonDisabled: {
      opacity: 0.7,
    },
    shuffleText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },
    countdownOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary + 'F2',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    countdownText: {
      fontFamily: typography.getFontFamily('bold'),
      //fontSize: Math.min(120, screenWidth * 0.3),
      color: colors.card,
    },
    revealOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary + 'F2',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: 20,
    },
    revealCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    revealText: {
      fontFamily: typography.getFontFamily('bold'),
      //fontSize: Math.min(32, screenWidth * 0.08),
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    revealSubtext: {
      fontFamily: typography.getFontFamily('normal'),
      //fontSize: Math.min(20, screenWidth * 0.05),
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
    },
    closeRevealButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      minHeight: 44,
    },
    closeRevealText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.card,
    },
    footerContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
  });
}