// components/PollResultsButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useMemo } from 'react';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;

interface PollResultsButtonProps {
  onPress: () => void;
}

export function PollResultsButton({ onPress }: PollResultsButtonProps) {
  const { colors, typography } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => {
        onPress();
        announceForAccessibility('Navigating to poll results');
      }}
      accessibilityLabel="View Results"
      accessibilityRole="button"
      accessibilityHint="Shows the current voting results for this poll"
    >
      <SFSymbolIcon name="barchart3" />
      <Text style={styles.buttonText}>View Results</Text>
    </TouchableOpacity>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44, // HIG minimum touch target
  },
  buttonText: {
    color: colors.card,
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    marginLeft: 8,
  },
});