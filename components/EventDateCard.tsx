import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { format } from 'date-fns';

import { EVENT_VOTING_OPTIONS, EVENT_ICON_MAP, EventVoteType, getEventIconColor, getEventVoteBgColor, getEventVoteBorderColor } from './eventVotingOptions';
import { PollEvent } from '@/types/poll';
import { TruncatedText } from './TruncatedText';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

interface EventDateCardProps {
  eventDate: PollEvent;
  index: number;
  selectedVote?: EventVoteType;
  onVote: (eventId: string, voteType: EventVoteType) => void;
  disabled?: boolean;
  voteCounts?: { yes: number; no: number; maybe: number };
  displayLocation: string;
  displayTime: string;
}

export const EventDateCard = ({
  eventDate,
  index,
  selectedVote,
  onVote,
  disabled = false,
  voteCounts,
  displayLocation,
  displayTime
}: EventDateCardProps) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);


  const getButtonStyle = (voteType: EventVoteType) => {
    const isSelected = selectedVote === voteType;
    return [
      styles.voteButton,
      {
        backgroundColor: getEventVoteBgColor(voteType, isSelected, colors),
        borderColor: getEventVoteBorderColor(voteType, isSelected, colors),
        borderWidth: isSelected ? 3 : 2,
        shadowColor: isSelected ? getEventVoteBorderColor(voteType, isSelected, colors) : 'transparent',
        shadowOpacity: isSelected ? 0.25 : 0,
        shadowRadius: isSelected ? 8 : 0,
        elevation: isSelected ? 4 : 0,
      },
    ];
  };

  const date = new Date(eventDate.event_date);

  return (
    <View style={styles.card}>
      {/* Date info and details */}
      <View style={styles.dateInfoRow}>
        <View style={styles.dateIcon}>
          <SFSymbolIcon name="calendar" />
        </View>
        <View style={styles.dateInfo}>
          <Text style={styles.dateText}>
            {format(date, 'EEEE, MMMM d, yyyy')}
          </Text>
          <View style={styles.dateDetails}>
            <View style={styles.dateDetailRow}>
              <SFSymbolIcon name="mappin" />
              <TruncatedText
                text={displayLocation}
                maxLength={35}
                textStyle={styles.dateDetailText}
                buttonTextStyle={styles.truncateButtonText}
              />
            </View>
            <View style={styles.dateDetailRow}>
              <SFSymbolIcon name="clock" />
              <Text style={styles.dateDetailText}>
                {displayTime}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Voting buttons */}
      <View style={styles.voteButtonsContainer}>
        {EVENT_VOTING_OPTIONS.map(option => {
          const IconComponent = EVENT_ICON_MAP[option.icon];
          return (
            <View key={option.value} style={styles.voteButtonWrapper}>
              <TouchableOpacity
                style={getButtonStyle(option.value)}
                onPress={() => {
                  onVote(eventDate.id, option.value);
                  announceForAccessibility(`Voted ${option.label} for event on ${displayTime}`);
                }}
                disabled={disabled}
                hitSlop={touchTargets.vote}
                accessibilityLabel={`Vote ${option.label.toLowerCase()} for this event date`}
                accessibilityRole="button"
                accessibilityHint={`Select ${option.label.toLowerCase()} as your availability for this event date`}
              >
                <IconComponent
                  size={20}
                  color={getEventIconColor(option.value, selectedVote === option.value, colors)}
                />
              </TouchableOpacity>
              <Text style={styles.voteButtonLabel}>{option.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.tints.accent,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: typography.fontSize.subheadline,
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.primary,
    marginBottom: 4,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  dateDetails: {
    marginVertical: -2,
  },
  dateDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateDetailText: {
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
    marginLeft: 6,
  },
  voteButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  voteButtonWrapper: {
    alignItems: 'center',
    marginHorizontal: 4,
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
    marginTop: 4,
    textAlign: 'center',
  },
  voteCount: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption2,
    color: colors.primary,
    marginTop: 2,
    textAlign: 'center',
  },
  truncateButtonText: {
    color: colors.accent,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('semibold'),
    textDecorationLine: 'underline',
  },
});
