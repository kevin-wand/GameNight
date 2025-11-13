import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useDeviceType } from '@/hooks/useDeviceType';

interface CreateEventDetailsProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (eventName: string, description: string, location: string) => void;
  currentEventName: string;
  currentDescription: string;
  currentLocation: string;
}

export const CreateEventDetails: React.FC<CreateEventDetailsProps> = ({
  isVisible,
  onClose,
  onSave,
  currentEventName,
  currentDescription,
  currentLocation,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const { screenHeight } = useDeviceType();
  const styles = useMemo(() => getStyles(colors, typography, screenHeight), [colors, typography, screenHeight]);

  const [eventName, setEventName] = useState(currentEventName);
  const [description, setDescription] = useState(currentDescription);
  const [location, setLocation] = useState(currentLocation);

  useEffect(() => {
    setEventName(currentEventName);
    setDescription(currentDescription);
    setLocation(currentLocation);
  }, [currentEventName, currentDescription, currentLocation]);

  const handleSave = () => {
    announceForAccessibility('Event details saved');
    onSave(eventName, description, location);
    onClose();
  };

  const handleClose = () => {
    announceForAccessibility('Event details editing cancelled');
    setEventName(currentEventName); // Reset to original value
    setDescription(currentDescription); // Reset to original value
    setLocation(currentLocation); // Reset to original value
    onClose();
  };

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
            <Text style={styles.title}>Edit Event Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityLabel="Close"
              accessibilityHint="Closes the event details editor"
              hitSlop={touchTargets.sizeTwenty}
            >
              <SFSymbolIcon name="x" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              <Text style={styles.label}>Event Name (Optional)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.titleInput, eventName ? styles.titleInputWithClearButton : null]}
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder="Enter Event Name"
                  placeholderTextColor={colors.textMuted}
                  maxLength={100}
                  autoFocus
                  accessibilityLabel="Event name input"
                  accessibilityHint="Enter a custom event title or leave blank for auto-generated name"
                />
                {eventName ? (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setEventName('')}
                    accessibilityLabel="Clear event name"
                    accessibilityHint="Clears the event name field"
                    hitSlop={touchTargets.small}
                  >
                    <SFSymbolIcon name="x" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={[styles.label, styles.locationLabel]}>Location (Optional)</Text>
              <TextInput
                style={styles.locationInput}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter default location for all dates"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
                accessibilityLabel="Location input"
                accessibilityHint="Enter the default location for all event dates"
              />

              <Text style={[styles.label, styles.descriptionLabel]}>Description (Optional)</Text>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Add context, details, or any additional information about the event"
                placeholderTextColor={colors.textMuted}
                maxLength={500}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Description input"
                accessibilityHint="Add additional details or context about the event"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              accessibilityLabel="Cancel"
              accessibilityHint="Cancels editing and discards changes"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              accessibilityLabel="Save"
              accessibilityHint="Saves the event details and closes the editor"
              hitSlop={touchTargets.small}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors'], typography: ReturnType<typeof useTheme>['typography'], screenHeight: number) => {
  const responsiveMinHeight = Math.max(300, Math.min(500, screenHeight * 0.6));

  return StyleSheet.create({
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
      paddingVertical: 12,
    },
    label: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginBottom: 8,
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
      minHeight: 44,
      width: '100%',
    },
    inputContainer: {
      position: 'relative',
    },
    titleInputWithClearButton: {
      paddingRight: 40,
    },
    clearButton: {
      position: 'absolute',
      right: 12,
      top: 20,
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    locationLabel: {
      marginTop: 12,
    },
    locationInput: {
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
      minHeight: 44,
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
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    cancelButton: {
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 10,
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
      paddingVertical: 10,
      borderRadius: 8,
    },
    saveButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#ffffff',
    },
  });
};
