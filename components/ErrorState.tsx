import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  const { colors, typography, touchTargets } = useTheme();
  const { isReduceMotionEnabled, announceForAccessibility } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);

  useEffect(() => {
    announceForAccessibility(`Error: ${message}`);
  }, [message, announceForAccessibility]);

  return (
    <Animated.View
      entering={isReduceMotionEnabled ? undefined : FadeIn.duration(300)}
      style={styles.container}
      accessibilityLiveRegion="assertive"
    >
      <AlertCircle size={48} color={colors.error} />
      <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => { onRetry(); announceForAccessibility('Retrying'); }}
        accessibilityLabel="Retry"
        accessibilityRole="button"
        accessibilityHint="Attempts to reload the content"
        hitSlop={touchTargets.small}
      >
        <SFSymbolIcon name="refresh" color="#ffffff" />
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>

      <Text style={styles.helpText}>
        Make sure your BGG username is correct and your collection is public.
      </Text>
    </Animated.View>
  );
};

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.title3,
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  retryText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: '#ffffff',
    marginLeft: 8,
  },
  helpText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});