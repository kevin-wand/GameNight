import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Modal, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import ToolsFooter from '@/components/ToolsFooter';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useDeviceType } from '@/hooks/useDeviceType';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  SlideInDown,
  SlideOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';


interface DiceResult {
  id: number;
  value: number;
  sides: number;
}

const STANDARD_DICE_SIDES = [4, 6, 8, 10, 12, 20];

export default function DigitalDiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const { screenHeight } = useDeviceType();

  const styles = useMemo(() => getStyles(colors, typography, touchTargets, screenHeight, insets), [colors, typography, touchTargets, screenHeight, insets]);
  const footerHeight = 60 + Math.max(8, Platform.OS === 'web' ? 0 : insets.bottom);
  const [sides, setSides] = useState(6);
  const [numberOfDice, setNumberOfDice] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<DiceResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customSides, setCustomSides] = useState('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Load haptic setting on mount
  useEffect(() => {
    const loadHapticSetting = async () => {
      try {
        const saved = await AsyncStorage.getItem('dice_haptic_enabled');
        if (saved !== null) {
          setHapticEnabled(JSON.parse(saved));
        }
      } catch (error) {
        console.log('Error loading haptic setting:', error);
      }
    };
    loadHapticSetting();
  }, []);

  // Save haptic setting when changed
  const toggleHaptic = async (value: boolean) => {
    setHapticEnabled(value);
    try {
      await AsyncStorage.setItem('dice_haptic_enabled', JSON.stringify(value));
    } catch (error) {
      console.log('Error saving haptic setting:', error);
    }
  };

  const rollDice = useCallback(() => {
    // Add haptic feedback for mobile (if enabled)
    if (Platform.OS !== 'web' && hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsRolling(true);
    setShowResults(false);
    setResults([]);

    // Generate random results
    const newResults: DiceResult[] = [];
    for (let i = 0; i < numberOfDice; i++) {
      newResults.push({
        id: i,
        value: Math.floor(Math.random() * sides) + 1,
        sides: sides,
      });
    }

    // Keep the same rolling screen duration (1000ms)
    setTimeout(() => {
      runOnJS(setResults)(newResults);
      runOnJS(setIsRolling)(false);
      runOnJS(setShowResults)(true);
      runOnJS(announceForAccessibility)(`Rolled ${numberOfDice} dice. Results: ${newResults.map(d => d.value).join(', ')}. Total: ${newResults.reduce((sum, dice) => sum + dice.value, 0)}`);
    }, 1000);
  }, [sides, numberOfDice, announceForAccessibility]);

  const resetDice = () => {
    setResults([]);
    setShowResults(false);
  };

  const handleSidesSelection = (selectedSides: number) => {
    setSides(selectedSides);
  };

  const handleCustomSides = () => {
    const customValue = parseInt(customSides);
    if (customValue && customValue >= 2 && customValue <= 1000) {
      setSides(customValue);
      setShowCustomModal(false);
      setCustomSides('');
    }
  };

  const adjustNumberOfDice = (increment: boolean) => {
    if (increment && numberOfDice < 10) {
      setNumberOfDice(numberOfDice + 1);
    } else if (!increment && numberOfDice > 1) {
      setNumberOfDice(numberOfDice - 1);
    }
  };

  const totalValue = results.reduce((sum, dice) => sum + dice.value, 0);

  // Rolling Animation Component - now only shows one die
  const RollingDice = useCallback(() => {
    // const rotation = useSharedValue(0);
    // const scale = useSharedValue(1);

    // const animatedStyle = useAnimatedStyle(() => {
    //   return {
    //     transform: [
    //       { rotate: `${rotation.value}deg` },
    //       { scale: scale.value },
    //     ],
    //   };
    // });

    // useEffect(() => {
    //   // Start rotation animation
    //   rotation.value = withRepeat(
    //     withTiming(360, { duration: 1000, easing: Easing.linear }),
    //     -1,
    //     false
    //   );

    //   // Start scale animation
    //   scale.value = withSequence(
    //     withTiming(1.2, { duration: 200 }),
    //     withRepeat(
    //       withTiming(0.8, { duration: 300, easing: Easing.inOut(Easing.ease) }),
    //       2,
    //       true
    //     ),
    //     withTiming(1, { duration: 200 })
    //   );
    // }, []);

    return (
      <Animated.View style={[styles.rollingDice]}>
        <SFSymbolIcon name="dice6" color="#10b981" />
      </Animated.View>
    );
  }, [styles]);

  const RollingDiceAnimation = useCallback(() => {
    return (
      <View style={styles.rollingDiceContainer}>
        <RollingDice />
      </View>
    );
  }, [styles, RollingDice]);


  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={{ uri: 'https://images.pexels.com/photos/278918/pexels-photo-278918.jpeg' }}
        style={styles.backgroundImage}
      />
      <View style={styles.overlay} />

      {/* Custom Sides Modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Dice Sides</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCustomModal(false)}
                hitSlop={touchTargets.getHitSlop(20)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <SFSymbolIcon name="x" color="#666666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter the number of sides (2-1000):
            </Text>

            <TextInput
              style={styles.customInput}
              value={customSides}
              onChangeText={setCustomSides}
              placeholder="Enter number of sides"
              keyboardType="numeric"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCustomModal(false)}
                accessibilityLabel="Cancel custom dice sides"
                accessibilityRole="button"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  (!customSides || parseInt(customSides) < 2 || parseInt(customSides) > 1000) && styles.modalConfirmButtonDisabled
                ]}
                onPress={handleCustomSides}
                disabled={!customSides || parseInt(customSides) < 2 || parseInt(customSides) > 1000}
                accessibilityLabel="Confirm custom dice sides"
                accessibilityRole="button"
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rolling Animation Overlay */}
      {isRolling && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.rollingOverlay}
        >
          <RollingDiceAnimation />
          <Text style={styles.rollingText}>Rolling...</Text>
        </Animated.View>
      )}

      {/* Results Overlay */}
      {showResults && !isRolling && (
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.resultsOverlay}
        >
          <Animated.View
            entering={SlideInDown.duration(800).springify()}
            exiting={SlideOutUp.duration(300)}
            style={styles.resultsCard}
          >
            <Text style={styles.resultsTitle}>Results</Text>

            <ScrollView
              style={styles.resultsScroll}
              contentContainerStyle={styles.resultsContainer}
              showsVerticalScrollIndicator={false}
            >
              {results.map((dice, index) => (
                <Animated.View
                  key={dice.id}
                  entering={ZoomIn.delay(index * 100).duration(300)}
                  style={styles.resultDice}
                >
                  <SFSymbolIcon name="dice6" color="#10b981" />
                  <Text style={styles.resultValue}>{dice.value}</Text>
                </Animated.View>
              ))}
            </ScrollView>

            {numberOfDice > 1 && (
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total: {totalValue}</Text>
              </View>
            )}

            <View style={styles.resultsActions}>
              <TouchableOpacity
                style={styles.rollAgainButton}
                onPress={rollDice}
                accessibilityLabel="Roll dice again"
                accessibilityRole="button"
              >
                <SFSymbolIcon name="rotateccw" color="#ffffff" />
                <Text style={styles.rollAgainText}>Roll Again</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeResultsButton}
                onPress={resetDice}
                accessibilityLabel="Close results"
                accessibilityRole="button"
              >
                <Text style={styles.closeResultsText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>Roll virtual dice for your board games</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Dice Sides Configuration */}
          <View style={styles.configSection}>
            <Text style={styles.configLabel}>Number of Sides</Text>
            <View style={styles.sidesGrid}>
              {STANDARD_DICE_SIDES.map((sideOption) => (
                <TouchableOpacity
                  key={sideOption}
                  style={[
                    styles.sideOption,
                    sides === sideOption && styles.sideOptionSelected
                  ]}
                  onPress={() => handleSidesSelection(sideOption)}
                  accessibilityLabel={`Select ${sideOption} sided dice`}
                  accessibilityRole="button"
                >
                  <Text style={[
                    styles.sideOptionText,
                    sides === sideOption && styles.sideOptionTextSelected
                  ]}>
                    d{sideOption}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.sideOption,
                  styles.customSideOption,
                  !STANDARD_DICE_SIDES.includes(sides) && styles.sideOptionSelected
                ]}
                onPress={() => setShowCustomModal(true)}
                accessibilityLabel="Select custom number of sides"
                accessibilityRole="button"
              >
                <Text style={[
                  styles.sideOptionText,
                  !STANDARD_DICE_SIDES.includes(sides) && styles.sideOptionTextSelected
                ]}>
                  {!STANDARD_DICE_SIDES.includes(sides) ? `d${sides}` : 'Other'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Number of Dice Configuration */}
          <View style={styles.configSection}>
            <Text style={styles.configLabel}>Number of Dice</Text>
            <View style={styles.configRow}>
              <TouchableOpacity
                style={[styles.adjustButton, numberOfDice <= 1 && styles.adjustButtonDisabled]}
                onPress={() => adjustNumberOfDice(false)}
                disabled={numberOfDice <= 1}
                accessibilityLabel="Decrease number of dice"
                accessibilityRole="button"
              >
                <SFSymbolIcon name="minus" />
              </TouchableOpacity>

              <View style={styles.valueContainer}>
                <Text style={styles.valueText}>{numberOfDice}</Text>
                <Text style={styles.valueSubtext}>{numberOfDice === 1 ? 'die' : 'dice'}</Text>
              </View>

              <TouchableOpacity
                style={[styles.adjustButton, numberOfDice >= 10 && styles.adjustButtonDisabled]}
                onPress={() => adjustNumberOfDice(true)}
                disabled={numberOfDice >= 10}
                accessibilityLabel="Increase number of dice"
                accessibilityRole="button"
              >
                <Plus size={20} color={numberOfDice >= 10 ? "#cccccc" : "#10b981"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <View style={styles.previewContainer}>
              {Array.from({ length: numberOfDice }, (_, index) => (
                <View key={index} style={styles.previewDice}>
                  <SFSymbolIcon name="dice6" color="#10b981" />
                </View>
              ))}
            </View>
            <Text style={styles.previewText}>
              Rolling {numberOfDice} {numberOfDice === 1 ? 'die' : 'dice'} with {sides} sides each
            </Text>
          </View>

          {/* Roll Button */}
          <TouchableOpacity
            style={[styles.rollButton, isRolling && styles.rollButtonDisabled]}
            onPress={rollDice}
            disabled={isRolling}
            accessibilityLabel={isRolling ? "Rolling dice" : "Roll dice"}
            accessibilityRole="button"
          >
            <SFSymbolIcon name="dice6" color="#ffffff" />
            <Text style={styles.rollButtonText}>
              {isRolling ? 'Rolling...' : 'Roll Dice'}
            </Text>
          </TouchableOpacity>

          {/* Settings Button */}
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => setShowSettings(true)}
              accessibilityLabel="Open settings"
              accessibilityRole="button"
            >
              <SFSymbolIcon name="settings" color="#666666" />
              <Text style={styles.settingsButtonText}>Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={showSettings}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dice Settings</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowSettings(false)}
                >
                  <SFSymbolIcon name="x" color="#666666" />
                </TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Haptic Feedback</Text>
                  <Text style={styles.settingDescription}>
                    Feel vibrations when rolling dice
                  </Text>
                </View>
                <Switch
                  value={hapticEnabled}
                  onValueChange={toggleHaptic}
                  trackColor={{ false: '#e1e5ea', true: '#ff9654' }}
                  thumbColor={hapticEnabled ? '#ffffff' : '#f4f3f4'}
                  accessibilityLabel="Toggle haptic feedback"
                  accessibilityRole="switch"
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
      <ToolsFooter currentScreen="tools" />
    </View>
  );
}

function getStyles(colors: any, typography: any, touchTargets: any, screenHeight: number, insets: any) {
  return StyleSheet.create({
    // === CONTAINER & LAYOUT ===
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
      backgroundColor: colors.primary + 'D9', // 85% opacity
    },
    scrollContainer: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
      minHeight: 60,
      justifyContent: 'center',
    },
    subtitle: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.headline,
      color: colors.card,
      textAlign: 'center',
    },
    content: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      padding: 20,
      minHeight: screenHeight * 0.7,
    },
    configSection: {
      marginBottom: 20,
    },
    configLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    configRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    sidesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    sideOption: {
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minWidth: 60,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      margin: 6,
    },
    sideOptionSelected: {
      borderColor: colors.success,
      backgroundColor: colors.tints.success,
    },
    sideOptionText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
    },
    sideOptionTextSelected: {
      color: colors.success,
    },
    customSideOption: {
      minWidth: 80,
    },

    // === ADJUST BUTTONS ===
    adjustButton: {
      width: 44,
      height: 44,
      borderRadius: 24,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    adjustButtonDisabled: {
      backgroundColor: colors.border,
    },
    valueContainer: {
      alignItems: 'center',
      minWidth: 80,
    },
    valueText: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      marginBottom: 4,
    },
    valueSubtext: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      textAlign: 'center',
    },
    valueLabel: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // === PREVIEW SECTION ===
    previewSection: {
      marginTop: 4,
      marginBottom: 12,
    },
    previewContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewDice: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 4,
    },
    previewText: {
      fontFamily: typography.getFontFamily('semi-bold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
      paddingTop: 16,
      textAlign: 'center',
      alignSelf: 'center',
    },
    previewLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    rollButton: {
      backgroundColor: colors.success,
      borderRadius: 16,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      minHeight: 44,
    },
    rollButtonDisabled: {
      opacity: 0.7,
    },
    rollButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.card,
      marginLeft: 8,
    },
    settingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    settingsButtonText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
      marginLeft: 8,
    },

    // === MODAL OVERLAYS ===
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.shadow + '80', // 50% opacity
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalDescription: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
      marginBottom: 20,
    },
    customInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
      minHeight: 44,
    },
    modalActions: {
      flexDirection: 'row',
    },
    modalCancelButton: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      minHeight: 44,
    },
    modalCancelText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
    },
    modalConfirmButton: {
      flex: 1,
      backgroundColor: colors.success,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      minHeight: 44,
      marginLeft: 12,
    },
    modalConfirmButtonDisabled: {
      opacity: 0.5,
    },
    modalConfirmText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.card,
    },

    // === ROLLING ANIMATION ===
    rollingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary + 'F5', // 95% opacity
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    rollingDiceContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    rollingText: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title1,
      color: colors.card,
    },
    rollingDice: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultsOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary + 'F5', // 95% opacity
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      padding: 20,
    },
    resultsCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      maxHeight: '90%',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 8,
    },
    resultsTitle: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    resultsScroll: {
      maxHeight: 280,
    },
    resultsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    resultsActions: {
      flexDirection: 'row',
      marginTop: 24,
    },
    rollAgainButton: {
      flex: 1,
      backgroundColor: colors.success,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    rollAgainText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.card,
      marginLeft: 8,
    },
    closeResultsButton: {
      backgroundColor: colors.border,
      borderRadius: 12,
      padding: 16,
      paddingHorizontal: 24,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 44,
      marginLeft: 12,
    },
    closeResultsText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
    },
    resultDice: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      minWidth: 75,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: colors.border,
      marginHorizontal: 4,
    },
    resultValue: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      marginTop: 8,
      marginBottom: 0,
    },
    diceValue: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      marginTop: 8,
      marginBottom: 0,
    },
    totalContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 2,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      textAlign: 'center',
      paddingBottom: 16,
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.textMuted,
      lineHeight: typography.lineHeight.normal * typography.fontSize.footnote,
    },
  });
}

