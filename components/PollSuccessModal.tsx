import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2, Users, Copy } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';

interface PollSuccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  onDone: () => void;
  pollUrl: string;
  onStartInPersonVoting?: () => void;
}

export const PollSuccessModal: React.FC<PollSuccessModalProps> = ({
  isVisible,
  onClose,
  onDone,
  pollUrl,
  onStartInPersonVoting,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(pollUrl);
      announceForAccessibility('Poll link copied to clipboard');
      Toast.show({ type: 'success', text1: 'Poll link copied to clipboard!' });
    } catch (err) {
      console.error('Failed to copy link:', err);
      Toast.show({ type: 'error', text1: 'Failed to copy link' });
    }
  };

  const handleStartInPersonVoting = () => {
    // Close the modal first
    onClose();
    announceForAccessibility('Starting in-person voting');
    // Call the callback if provided, otherwise the parent will handle navigation
    if (onStartInPersonVoting) {
      onStartInPersonVoting();
    }
    onDone();
  };

  const styles = useMemo(() => getStyles(colors, typography, insets), [colors, typography, insets]);

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDone}
            accessibilityLabel="Close"
            accessibilityHint="Closes the poll success modal"
            hitSlop={touchTargets.small}
          >
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.content}>
            {/* Success Header */}
            <View style={styles.successHeader}>
              <Text style={styles.title}>Poll Created!</Text>
            </View>

            {/* Share Link Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Share2 size={20} color={colors.accent} />
                <Text style={styles.sectionTitle}>Share the Link</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Send this link to your friends so they can vote from anywhere
              </Text>
              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="middle">
                  {pollUrl}
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={handleCopyLink}
                  accessibilityLabel="Copy poll link"
                  accessibilityHint="Copies the poll link to your clipboard"
                  hitSlop={touchTargets.small}
                >
                  <Copy size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* In-Person Voting Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Users size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Vote In-Person</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Pass your device around for everyone to vote on the same screen
              </Text>
              <TouchableOpacity
                style={styles.startVotingButton}
                onPress={handleStartInPersonVoting}
                accessibilityLabel="Start in-person voting"
                accessibilityHint="Opens the poll for in-person voting on this device"
                hitSlop={touchTargets.small}
              >
                <Users size={20} color="#ffffff" />
                <Text style={styles.startVotingButtonText}>Start In-Person Voting</Text>
              </TouchableOpacity>
            </View>

            {/* Done Button */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                announceForAccessibility('Poll creation completed');
                onDone();
              }}
              accessibilityLabel="Done - close all modals"
              accessibilityHint="Completes the poll creation process and closes all modals"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

type Styles = {
  overlay: ViewStyle;
  dialog: ViewStyle;
  closeButton: ViewStyle;
  content: ViewStyle;
  successHeader: ViewStyle;
  title: TextStyle;
  section: ViewStyle;
  sectionHeader: ViewStyle;
  sectionTitle: TextStyle;
  sectionDescription: TextStyle;
  linkContainer: ViewStyle;
  linkText: TextStyle;
  copyButton: ViewStyle;
  startVotingButton: ViewStyle;
  startVotingButtonText: TextStyle;
  doneButton: ViewStyle;
  doneButtonText: TextStyle;
};

const getStyles = (colors: any, typography: any, insets: any) => StyleSheet.create<Styles>({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingTop: Math.max(20, insets.top),
    paddingBottom: Math.max(20, insets.bottom),
    paddingHorizontal: 20,
  },

  dialog: {
    backgroundColor: colors.card,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
    maxWidth: 500,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
  },
  content: {
    padding: 24,
    paddingTop: 12,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    marginTop: 12,
    fontSize: typography.fontSize.title3,
    color: colors.text,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: typography.fontSize.body,
    color: colors.text,
    marginLeft: 12,
    fontWeight: 'bold',
  },
  sectionDescription: {
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 15,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkText: {
    flex: 1,
    fontSize: typography.fontSize.caption2,
    color: colors.textMuted,
    marginRight: 8,
  },
  copyButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startVotingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: 12,
  },
  startVotingButtonText: {
    fontSize: typography.fontSize.caption1,
    color: '#ffffff',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    fontSize: typography.fontSize.body,
    color: '#ffffff',
    fontWeight: '600',
  },
});
