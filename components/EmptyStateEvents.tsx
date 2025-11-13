import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

interface EmptyStateEventsProps {
  onCreate: () => void;
}

export const EmptyStateEvents: React.FC<EmptyStateEventsProps> = ({ onCreate }) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography, touchTargets), [colors, typography, touchTargets]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>No Events Yet</Text>
      <Text style={styles.subtitle}>
        Create an event poll to help your group decide when to play!
      </Text>

      <View style={styles.stepsContainer}>
        <View style={styles.stepRow}>
          <SFSymbolIcon name="calendar" />
          <Text style={styles.stepText}><Text style={styles.stepBoldText}>Pick Times</Text> – Select the dates/times that work for you</Text>
        </View>
        <View style={styles.stepRow}>
          <SFSymbolIcon name="check-square" />
          <Text style={styles.stepText}><Text style={styles.stepBoldText}>Provide Info</Text> – Let them know the location and relevant details of the game night</Text>
        </View>
        <View style={styles.stepRow}>
          <SFSymbolIcon name="share2" />
          <Text style={styles.stepText}><Text style={styles.stepBoldText}>Share</Text> – Send the poll via link</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          onCreate();
          announceForAccessibility('Opening create event modal');
        }}
        activeOpacity={0.8}
        accessibilityLabel="Create a new poll"
        accessibilityRole="button"
        accessibilityHint="Opens the poll creation modal"
      >
        <SFSymbolIcon name="plus" />
        <Text style={styles.buttonText}>Create Event Poll</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Note: Registered users can change their votes anytime. Anonymous voters can revote until they close their browser.
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
  },
  title: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: typography.getFontFamily('regular'),
    fontSize: typography.fontSize.callout,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
    lineHeight: typography.lineHeight.body,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 0,
    alignItems: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
    maxWidth: 320,
  },
  stepIcon: {
    marginRight: 12,
  },
  stepText: {
    fontFamily: typography.getFontFamily('regular'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    flex: 1,
  },
  stepBoldText: {
    fontFamily: typography.getFontFamily('semibold'),
  },
  note: {
    fontFamily: typography.getFontFamily('regular'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: typography.lineHeight.caption1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    marginBottom: 20,
    marginTop: 16,
    minHeight: touchTargets.standard.height,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: colors.card,
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
  },
}); 