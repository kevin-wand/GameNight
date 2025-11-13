// currently not used. for purpose of future development.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity, Platform } from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useDeviceType } from '@/hooks/useDeviceType';

interface CreatePollAddOptionsProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (options: any) => void;
  currentOptions?: any;
}

export const CreatePollAddOptions: React.FC<CreatePollAddOptionsProps> = ({
  isVisible,
  onClose,
  onSave,
  currentOptions = {},
}) => {
  const deviceType = useDeviceType();

  const handleSave = () => {
    onSave(currentOptions);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.dialog}>
        <View style={styles.header}>
          <Text style={styles.title}>Additional Options</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessibilityLabel="Close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <SFSymbolIcon name="x" color="#666666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Coming Soon</Text>
          <Text style={styles.sublabel}>
            Additional poll configuration options will be available here in a future update.
          </Text>

          <View style={styles.placeholderContent}>
            <Text style={styles.placeholderText}>
              Future options may include:
            </Text>
            <Text style={styles.optionText}>• Maximum votes per person</Text>
            <Text style={styles.optionText}>• Voting deadline</Text>
            <Text style={styles.optionText}>• Anonymous voting</Text>
            <Text style={styles.optionText}>• Custom voting rules</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

type Styles = {
  overlay: ViewStyle;
  dialog: ViewStyle;
  header: ViewStyle;
  closeButton: ViewStyle;
  title: TextStyle;
  content: ViewStyle;
  label: TextStyle;
  sublabel: TextStyle;
  placeholderContent: ViewStyle;
  placeholderText: TextStyle;
  optionText: TextStyle;
  footer: ViewStyle;
  cancelButton: ViewStyle;
  cancelButtonText: TextStyle;
};

const styles = StyleSheet.create<Styles>({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: Platform.OS === 'web' ? 20 : 10,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
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
    padding: Platform.OS === 'web' ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5ea',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1a2b5f',
  },
  content: {
    padding: Platform.OS === 'web' ? 20 : 16,
  },
  label: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#1a2b5f',
    marginBottom: 8,
  },
  sublabel: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
  },
  placeholderContent: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e1e5ea',
  },
  placeholderText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#1a2b5f',
    marginBottom: 12,
  },
  optionText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#666666',
    marginBottom: 6,
    paddingLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Platform.OS === 'web' ? 20 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e1e5ea',
  },
  cancelButton: {
    backgroundColor: '#ff9654',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#ffffff',
  },
});
