import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity, TextInput, Platform, Modal, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useDeviceType } from '@/hooks/useDeviceType';

interface CreatePollDetailsProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (title: string, description: string) => void;
  currentTitle: string;
  currentDescription: string;
}

export const CreatePollDetails: React.FC<CreatePollDetailsProps> = ({
  isVisible,
  onClose,
  onSave,
  currentTitle,
  currentDescription,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const { screenHeight } = useDeviceType();
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);

  useEffect(() => {
    setTitle(currentTitle);
    setDescription(currentDescription);
  }, [currentTitle, currentDescription]);

  const handleSave = () => {
    onSave(title, description);
    announceForAccessibility('Poll details saved');
    onClose();
  };

  const handleClose = () => {
    setTitle(currentTitle); // Reset to original value
    setDescription(currentDescription); // Reset to original value
    announceForAccessibility('Poll details editing cancelled');
    onClose();
  };

  const styles = useMemo(() => getStyles(colors, typography, screenHeight), [colors, typography, screenHeight]);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Poll Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityLabel="Close"
              accessibilityHint="Closes the poll details editor"
              hitSlop={touchTargets.sizeTwenty}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <Text style={styles.label}>Poll Title (Optional)</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter Poll Title"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
                accessibilityLabel="Poll title input"
                accessibilityHint="Enter a custom title for your poll or keep the auto-generated name"
              />

              <Text style={[styles.label, styles.descriptionLabel]}>Description (Optional)</Text>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Add context, instructions, or any additional information for voters"
                placeholderTextColor={colors.textMuted}
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Poll description input"
                accessibilityHint="Add context, instructions, or additional information for voters"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              hitSlop={touchTargets.small}
              accessibilityLabel="Cancel"
              accessibilityHint="Discards changes and closes the editor"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              hitSlop={touchTargets.small}
              accessibilityLabel="Save"
              accessibilityHint="Saves the poll details and closes the editor"
            >
              <Text style={styles.saveButtonText}>Save</Text>
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
  header: ViewStyle;
  closeButton: ViewStyle;
  title: TextStyle;
  content: ViewStyle;
  scrollContent: ViewStyle;
  label: TextStyle;
  sublabel: TextStyle;
  titleInput: TextStyle;
  descriptionLabel: TextStyle;
  descriptionInput: TextStyle;
  footer: ViewStyle;
  cancelButton: ViewStyle;
  cancelButtonText: TextStyle;
  saveButton: ViewStyle;
  saveButtonText: TextStyle;
};

const getStyles = (colors: any, typography: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(300, Math.min(500, screenHeight * 0.6));

  return StyleSheet.create<Styles>({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: 20,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: '100%',
      maxWidth: 500,
      minHeight: responsiveMinHeight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      position: 'relative',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.headline,
      color: colors.text,
    },
    scrollContent: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    label: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginBottom: 8,
    },
    sublabel: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      marginBottom: 6,
    },
    titleInput: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 6,
      marginBottom: 0,
    },
    descriptionLabel: {
      marginTop: 12,
    },
    descriptionInput: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginTop: 6,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },
    cancelButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
    },
    saveButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
    },
    saveButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
  });
};
