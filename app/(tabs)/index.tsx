import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useMemo } from 'react';
import SFSymbolIcon, { SFSymbolIconProps } from '@/components/SFSymbolIcon';

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, typography, touchTargets } = useTheme();
  const { screenHeight } = useDeviceType();

  // Use fallback values for web platform
  const safeAreaBottom = Platform.OS === 'web' ? 0 : insets.bottom;

  const tools = [
    {
      id: 'first-player',
      title: 'First Player Select',
      description: 'Randomly select who goes first',
      icon: "shuffle",
      color: colors.warning,
      backgroundColor: colors.tints.warningBgDark,
      onPress: () => router.navigate('/tools/first-player'),
    },
    {
      id: 'digital-dice',
      title: 'Digital Dice',
      description: 'Roll virtual dice for your games',
      icon: "dice6",
      color: colors.success,
      backgroundColor: colors.tints.success,
      onPress: () => router.navigate('/tools/digital-dice'),
    },
    {
      id: 'score-tracker',
      title: 'Score Tracker',
      description: 'Keep track of player scores',
      icon: "trophy",
      color: colors.accent,
      backgroundColor: colors.tints.accent,
      onPress: () => router.navigate('/tools/score-tracker'),
    },
  ];

  const styles = useMemo(() => getStyles(colors, typography, screenHeight), [colors, typography, screenHeight]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* Header Section with Background */}
      <View style={styles.headerSection}>
        <Image
          source={{ uri: 'https://images.pexels.com/photos/278918/pexels-photo-278918.jpeg' }}
          style={styles.backgroundImage}
        />
        <View style={styles.overlay} />

        <View style={styles.headerContent}>
          {/*<Text style={styles.title}>Game Tools</Text>*/}
          <Text style={styles.subtitle}>Useful utilities for your board game sessions</Text>
        </View>
      </View>

      {/* Tools Content Section */}
      <View style={[styles.toolsSection, { paddingBottom: 80 + safeAreaBottom }]}>
        {tools.map((tool, index) => {
          return (
            <Animated.View
              key={tool.id}
              style={styles.toolCard}
            >
              <TouchableOpacity
                style={[styles.toolButton, { backgroundColor: tool.backgroundColor }]}
                onPress={tool.onPress}
                activeOpacity={0.7}
                accessibilityLabel={`Open ${tool.title}`}
                accessibilityRole="button"
                accessibilityHint={`Opens the ${tool.title} tool`}
              >
                <View style={styles.toolIconContainer}>
                  <SFSymbolIcon name={tool.icon as SFSymbolIconProps['name']} size={24} color={tool.color} />
                </View>

                <View style={styles.toolContent}>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  <Text style={styles.toolDescription}>{tool.description}</Text>
                </View>

                <View style={styles.toolArrow}>
                  <View style={[styles.arrowIcon, { backgroundColor: tool.color }]} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: any, typography: any, screenHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: screenHeight,
  },
  headerSection: {
    height: Math.max(110, screenHeight * 0.1),
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 43, 95, 0.85)',
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 0,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  subtitle: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: '#ffffff',
    textAlign: 'left',
    opacity: 0.9,
    marginTop: -25,
  },
  toolsSection: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    paddingTop: 30,
    paddingHorizontal: 20,
    minHeight: screenHeight * 0.6,
  },
  toolCard: {
    marginBottom: 16,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 60,
    flexShrink: 1,
  },
  toolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toolContent: {
    flex: 1,
    paddingRight: 12,
  },
  toolTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.primary,
    marginBottom: 4,
  },
  toolDescription: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
    flexWrap: 'wrap',
  },
  toolArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});