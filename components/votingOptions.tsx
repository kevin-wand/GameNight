import React from 'react';
import { Text } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;

export const VOTING_OPTIONS = [
  { value: 'voteType1', icon: 'voteType1Icon', label: 'Excited', score: 3 },
  { value: 'voteType2', icon: 'voteType2Icon', label: 'Like', score: 2 },
  { value: 'voteType3', icon: 'voteType3Icon', label: 'Would Play', score: 1 },
  // { value: 'voteType4', icon: 'voteType4Icon', label: 'Don\'t Know', score: 0 },
  { value: 'voteType5', icon: 'voteType5Icon', label: 'Veto', score: -3 },
] as const;

export type VoteType = typeof VOTING_OPTIONS[number]['value'];
export type IconName = typeof VOTING_OPTIONS[number]['icon'];

export const ICON_MAP: Record<IconName, React.ComponentType<any> | string> = {
  voteType1Icon: "laugh",
  voteType2Icon: "smile",
  voteType3Icon: "meh",
  // voteType4Icon: "helpcircle",
  voteType5Icon: "thumbsdown",
};

export const VOTE_TYPE_TO_SCORE = Object.fromEntries(VOTING_OPTIONS.map(opt => [opt.value, opt.score]));
export const SCORE_TO_VOTE_TYPE = Object.fromEntries(VOTING_OPTIONS.map(opt => [opt.score, opt.value]));

// Utility function to map score to voteType key
export const getVoteTypeKeyFromScore = (score: number): string => {
  switch (score) {
    case 3: return 'voteType1';  // Excited
    case 2: return 'voteType2';  // Like
    case 1: return 'voteType3';  // Would Play
    // case 0: return 'voteType4';  // Don't Know
    case -3: return 'voteType5'; // Veto
    default: return 'voteType4'; // Default to Don't Know
  }
};

// Utility function to get icon color based on vote type and selection state
export const getIconColor = (voteType: string, isSelected: boolean = false, colors?: any): string => {
  if (isSelected) {
    switch (voteType) {
      case 'voteType1': return colors?.success || '#10b981';
      case 'voteType2': return colors?.success || '#10b981';
      case 'voteType3': return colors?.warning || '#fbbf24';
      // case 'voteType4': return colors?.warning || '#fbbf24';
      case 'voteType5': return colors?.error || '#ef4444';
    }
  }
  return colors?.textMuted || '#666666';
};

// Helpers to keep vote color logic consistent across components
export const getVoteBgColor = (score: number, isSelected: boolean, colors: any): string => {
  if (!isSelected) return colors.tints.neutral;
  if (score > 2) return colors.tints.success;
  if (score < 0) return colors.tints.error;
  return colors.tints.warningBg;
};

export const getVoteBorderColor = (score: number, isSelected: boolean, colors: any): string => {
  if (!isSelected) return 'transparent';
  if (score > 2) return colors.success;
  if (score < 0) return colors.error;
  return colors.warning;
};