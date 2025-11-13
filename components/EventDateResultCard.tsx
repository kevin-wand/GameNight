import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { EVENT_VOTING_OPTIONS, EVENT_ICON_MAP, EventVoteType, getEventIconColor, getEventVoteBgColor } from './eventVotingOptions';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useMemo } from 'react';
import { PollEvent } from '@/types/poll';
import { format } from 'date-fns';
import { TruncatedText } from './TruncatedText';

interface EventVotes {
  votes: Record<string, number>; // voteType1: 3, voteType2: 1, etc.
  voters: { name: string; vote_type: number }[];
}

interface EventDateResultCardProps {
  eventDate: {
    date: PollEvent;
    ranking: number;
    totalScore: number;
    totalVotes: number;
    voteCounts: { yes: number; no: number; maybe: number };
    votes: EventVotes;
  };
  votes: EventVotes;
  displayLocation: string;
  displayTime: string;
}

export function EventDateResultCard({
  eventDate,
  votes,
  displayLocation,
  displayTime
}: EventDateResultCardProps) {
  const { colors, typography } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);
  const [showVoters, setShowVoters] = useState(false);

  // Ensure votes exists
  if (!votes) {
    console.warn('Event votes is undefined for date:', eventDate.id);
    return (
      <View style={styles.card}>
        <Text style={styles.dateText}>Vote data unavailable</Text>
      </View>
    );
  }

  // Calculate total votes using array manipulation
  const totalVotes = Object.values(votes.votes).reduce((sum, count) => sum + count, 0);

  // Group voters by their vote type
  const getVotersByType = () => {
    const votersByType: Record<string, string[]> = {};
    EVENT_VOTING_OPTIONS.forEach(opt => { votersByType[opt.value] = []; });

    if (votes.voters && Array.isArray(votes.voters)) {
      votes.voters.forEach(voter => {
        const voteTypeKey = voter.vote_type.toString();
        if (votersByType[voteTypeKey]) {
          votersByType[voteTypeKey].push(voter.name);
        }
      });
    }
    return votersByType;
  };
  const votersByType = getVotersByType();

  const date = new Date(eventDate.date.event_date);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
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
        <View style={styles.rankingContainer}>
          <Text style={styles.rankingText}>
            #{eventDate.ranking}
          </Text>
        </View>
      </View>

      <View style={styles.votesContainer}>
        {EVENT_VOTING_OPTIONS.map(function (option: typeof EVENT_VOTING_OPTIONS[number]) {
          const voteTypeKey = option.value.toString();
          const voteCount = votes.votes[voteTypeKey] || 0;
          return (
            <View style={styles.voteItem} key={option.value}>
              <View style={styles.voteIconContainer}>
                {(() => {
                  const IconComponent = EVENT_ICON_MAP[option.icon];
                  if (IconComponent && (typeof IconComponent === 'function' || typeof IconComponent === 'object')) {
                    return <IconComponent size={24} color={getEventIconColor(option.value, false, colors)} />;
                  }
                  return null;
                })()}
                <Text style={[styles.voteCount, { backgroundColor: getEventVoteBgColor(option.value, true, colors) }]}>
                  {voteCount}
                </Text>
              </View>
              <Text style={styles.voteLabel}>{option.label}</Text>
            </View>
          );
        })}
      </View>

      {totalVotes > 0 && (
        <View style={styles.votersSection}>
          <TouchableOpacity
            style={styles.showVotersButton}
            onPress={() => {
              setShowVoters(!showVoters);
              announceForAccessibility(showVoters ? 'Voters list hidden' : 'Voters list shown');
            }}
            accessibilityRole="button"
            accessibilityLabel={showVoters ? 'Hide voters list' : 'Show voters list'}
            accessibilityHint="Toggles display of voter names for each vote type"
          >
            <Text style={styles.showVotersText}>
              {showVoters ? 'Hide Voters' : 'Show Voters'}
            </Text>
            {showVoters ? (
              <SFSymbolIcon name="chevron-up" />
            ) : (
              <SFSymbolIcon name="chevron-down" />
            )}
          </TouchableOpacity>
          {showVoters && (
            <View style={styles.votersDetails}>
              {EVENT_VOTING_OPTIONS.map(option => (
                votersByType[option.value.toString()]?.length > 0 && (
                  <View style={styles.voteTypeSection} key={option.value}>
                    <View style={styles.voteTypeHeader}>
                      {(() => {
                        const IconComponent = EVENT_ICON_MAP[option.icon];
                        if (IconComponent && (typeof IconComponent === 'function' || typeof IconComponent === 'object')) {
                          return <IconComponent size={16} color={getEventIconColor(option.value, false, colors)} />;
                        }
                        return null;
                      })()}
                      <Text style={[styles.voteTypeLabel]}>
                        {option.label} ({votersByType[option.value.toString()].length})
                      </Text>
                    </View>
                    <Text style={styles.votersList}>
                      {votersByType[option.value.toString()].join(', ')}
                    </Text>
                  </View>
                )
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  rankingContainer: {
    backgroundColor: colors.tints.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  rankingText: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.callout,
    color: colors.accent,
  },
  votesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
  },
  voteItem: {
    alignItems: 'center',
    flex: 1,
  },
  voteIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  voteCount: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.callout,
    marginTop: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 28,
    textAlign: 'center',
  },
  voteLabel: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  votersSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  showVotersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.tints.accent,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    minHeight: 44,
  },
  showVotersText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.accent,
    marginRight: 4,
  },
  votersDetails: {
    marginTop: 12,
  },
  voteTypeSection: {
    marginBottom: 12,
  },
  voteTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  voteTypeLabel: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.primary,
    marginLeft: 6,
  },
  votersList: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.textMuted,
    lineHeight: typography.lineHeight.normal * typography.fontSize.subheadline,
    marginLeft: 22,
  },
  truncateButtonText: {
    color: colors.accent,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('semibold'),
    textDecorationLine: 'underline',
  },
});
