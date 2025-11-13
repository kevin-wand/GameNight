import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';

interface SyncModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSync: (username: string) => Promise<void>;
  onUpdateProfile?: (username: string) => Promise<void>;
  loading?: boolean;
  syncProgress?: {
    stage: 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete';
    message: string;
    progress?: number;
  } | null;
  savedBggUsername?: string | null;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isVisible,
  onClose,
  onSync,
  onUpdateProfile,
  loading = false,
  syncProgress,
  savedBggUsername,
}) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [viewMode, setViewMode] = useState<'buttons' | 'input'>('buttons');
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled } = useAccessibility();
  const insets = useSafeAreaInsets();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const styles = useMemo(() => getStyles(colors, typography, insets), [colors, typography, insets]);

  useEffect(() => {
    if (!loading) return;
    if (!syncProgress) return;
    if (syncProgress.stage === 'complete') {
      announceForAccessibility('Collection imported successfully');
    } else if (syncProgress.message) {
      announceForAccessibility(syncProgress.message);
    }
  }, [loading, syncProgress?.stage, syncProgress?.message, announceForAccessibility]);

  // Clear username input on successful completion
  useEffect(() => {
    if (syncProgress?.stage === 'complete') {
      setUsername('');
    }
  }, [syncProgress?.stage]);

  // Reset view mode when modal opens
  useEffect(() => {
    if (isVisible) {
      setViewMode(savedBggUsername ? 'buttons' : 'input');
      setSaveToProfile(true);
      setError('');
    }
  }, [isVisible, savedBggUsername]);

  const handleSync = async () => {
    if (!username.trim()) {
      setError('Please enter a BoardGameGeek username');
      announceForAccessibility('Please enter a BoardGameGeek username');
      return;
    }
    setError('');
    try {
      // Save to profile first if checkbox is checked
      if (saveToProfile && onUpdateProfile) {
        await onUpdateProfile(username.trim());
      }
      await onSync(username.trim());
      announceForAccessibility('Starting collection import');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync collection');
      announceForAccessibility('Failed to sync collection');
    }
  };

  const handleSyncSavedUsername = async () => {
    if (!savedBggUsername) return;
    setError('');
    try {
      await onSync(savedBggUsername);
      announceForAccessibility(`Starting collection import for ${savedBggUsername}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync collection');
      announceForAccessibility('Failed to sync collection');
    }
  };

  const handleImportAnother = () => {
    setViewMode('input');
    setUsername('');
    setSaveToProfile(true);
    setError('');
    announceForAccessibility('Switched to manual input mode');
  };

  const getProgressMessage = () => {
    if (!syncProgress) return 'Importing Games...';
    return syncProgress.message;
  };

  const getProgressIcon = () => {
    if (syncProgress?.stage === 'complete') {
      return <SFSymbolIcon name="checkcircle" />;
    }
    return <ActivityIndicator color="#ffffff" size="small" />;
  };

  const renderFlow1 = () => (
    <>
      <Text style={styles.description}>
        Enter your BoardGameGeek username to import your collection
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="BGG Username"
          placeholderTextColor={colors.textMuted}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="BoardGameGeek username"
          accessibilityHint="Enter your BoardGameGeek username"
        />
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setSaveToProfile(!saveToProfile)}
          disabled={loading}
          accessibilityLabel={saveToProfile ? "Uncheck to not save username" : "Check to save username"}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: saveToProfile }}
          accessibilityHint="Saves the BGG username to your profile for future imports"
        >
          <View style={[styles.checkboxBox, saveToProfile && styles.checkboxChecked]}>
            {saveToProfile && <SFSymbolIcon name="checkcircle" color="#ffffff" />}
          </View>
          <Text style={styles.checkboxText}>
            {savedBggUsername ? 'Update BGG username on my Klack profile for future imports' : 'Add BGG username to my Klack profile for future imports'}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.syncButton, loading && styles.syncButtonDisabled]}
        onPress={handleSync}
        disabled={loading}
        accessibilityLabel="Import collection"
        accessibilityRole="button"
        accessibilityHint="Starts importing your collection from BoardGameGeek"
        hitSlop={touchTargets.small}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            {getProgressIcon()}
            <Text style={styles.syncButtonText}>{getProgressMessage()}</Text>
          </View>
        ) : (
          <>
            <SFSymbolIcon name="search" color="#ffffff" />
            <Text style={styles.syncButtonText}>Import Collection</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );

  const renderFlow2 = () => (
    <>
      <Text style={styles.description}>
        Import your saved collection or another collection
      </Text>

      <TouchableOpacity
        style={[styles.syncButton, loading && styles.syncButtonDisabled]}
        onPress={handleSyncSavedUsername}
        disabled={loading}
        accessibilityLabel={`Import ${savedBggUsername}'s collection`}
        accessibilityRole="button"
        accessibilityHint={`Starts importing ${savedBggUsername}'s collection from BoardGameGeek`}
        hitSlop={touchTargets.small}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            {getProgressIcon()}
            <Text style={styles.syncButtonText}>{getProgressMessage()}</Text>
          </View>
        ) : (
          <>
            <SFSymbolIcon name="search" color="#ffffff" />
            <Text style={styles.syncButtonText}>Import {savedBggUsername}'s Collection</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.secondaryButton, loading && styles.syncButtonDisabled]}
        onPress={handleImportAnother}
        disabled={loading}
        accessibilityLabel="Import another collection"
        accessibilityRole="button"
        accessibilityHint="Opens form to import a different user's collection"
        hitSlop={touchTargets.small}
      >
        <Text style={styles.secondaryButtonText}>Import Another Collection</Text>
      </TouchableOpacity>
    </>
  );

  const content = (
    <View style={styles.dialog}>
      <View style={styles.header}>
        <Text style={styles.title}>Connect to BoardGameGeek</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => { onClose(); announceForAccessibility('Sync modal closed'); }}
          accessibilityLabel="Close"
          accessibilityRole="button"
          accessibilityHint="Closes the sync modal"
          hitSlop={touchTargets.sizeTwenty}
        >
          <SFSymbolIcon name="x" />
        </TouchableOpacity>
      </View>

      {viewMode === 'input' ? renderFlow1() : renderFlow2()}

      {syncProgress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${syncProgress.progress || 0}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {syncProgress.stage === 'complete' ? 'Collection imported successfully!' : getProgressMessage()}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {content}
      </View>
    </Modal>
  );
};

const getStyles = (colors: any, typography: any, insets: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Math.max(20, insets.top),
    paddingBottom: Math.max(20, insets.bottom),
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.headline,
    color: colors.text,
  },
  description: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.textMuted,
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  errorText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.error,
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  savedUsernameButton: {
    backgroundColor: colors.textMuted,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: '#ffffff',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: colors.textMuted,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: '#ffffff',
  },
});
