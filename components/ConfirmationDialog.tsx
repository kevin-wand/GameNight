import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useRegisterModalSurface } from '@/contexts/ModalSurfaceContext';

interface ConfirmationDialogProps {
  isVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isVisible,
  onConfirm,
  onCancel,
  title,
  message,
  confirmButtonText = 'Delete'
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  useRegisterModalSurface('ConfirmationDialog', isVisible);

  const styles = useMemo(() => getStyles(colors, typography, touchTargets), [colors, typography, touchTargets]);

  if (!isVisible) return null;

  const handleCancel = () => {
    announceForAccessibility('Dialog cancelled');
    onCancel();
  };

  const handleConfirm = () => {
    announceForAccessibility('Action confirmed');
    onConfirm();
  };

  // On web, we'll use a positioned div instead of Modal
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webOverlay}>
        <View style={styles.webDialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityLabel="Cancel action"
              accessibilityRole="button"
              hitSlop={touchTargets.standard}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              accessibilityLabel={`Confirm ${confirmButtonText.toLowerCase()}`}
              accessibilityRole="button"
              hitSlop={touchTargets.standard}
            >
              <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      accessibilityViewIsModal={true}
      accessibilityLabel={`${title} dialog`}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              accessibilityLabel="Cancel action"
              accessibilityRole="button"
              hitSlop={touchTargets.standard}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              accessibilityLabel={`Confirm ${confirmButtonText.toLowerCase()}`}
              accessibilityRole="button"
              hitSlop={touchTargets.standard}
            >
              <Text style={styles.confirmButtonText}>{confirmButtonText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any, typography: any, touchTargets: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  webDialog: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: `0px 4px 16px ${colors.shadow}30`,
  },
  title: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.headline,
    color: colors.text,
    marginBottom: 8,
  },
  message: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    marginBottom: 24,
    lineHeight: typography.lineHeight.body,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.tints.neutral,
    marginRight: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.tints.error,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
  },
  confirmButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.error,
  },
});