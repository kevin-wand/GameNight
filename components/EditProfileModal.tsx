import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { supabase } from '@/services/supabase';
import { validateProfileFields } from '@/utils/profanityFilter';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (profile: {
    username: string;
    firstname: string | null;
    lastname: string | null;
    bgg_username: string | null;
  }) => void;
  initialData: {
    username: string;
    firstname: string | null;
    lastname: string | null;
    bgg_username: string | null;
  };
  loading: boolean;
}

export default function EditProfileModal({
  visible,
  onClose,
  onSave,
  initialData,
  loading,
}: EditProfileModalProps) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bggUsername, setBggUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(visible);

  const styles = getStyles(colors, typography, touchTargets);

  // Initialize form with current data
  useEffect(() => {
    if (visible && initialData) {
      setUsername(initialData.username || '');
      setFirstName(initialData.firstname || '');
      setLastName(initialData.lastname || '');
      setBggUsername(initialData.bgg_username || '');
      setError(null);
    }
  }, [visible, initialData]);

  const checkUsernameAvailability = async (newUsername: string) => {
    if (!newUsername.trim() || newUsername === initialData.username) {
      return true; // No change or empty, consider available
    }

    try {
      setIsCheckingUsername(true);
      const { data: existingUser, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', newUsername.trim())
        .neq('id', (await supabase.auth.getUser()).data.user?.id) // Exclude current user
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Username check error:', error);
        return false;
      }

      return !existingUser; // Available if no existing user found
    } catch (err) {
      console.error('Error checking username:', err);
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);

      // Validation
      if (!username.trim()) {
        setError('Username is required');
        return;
      }

      // Check for profanity in all fields
      const profanityValidation = validateProfileFields(username);
      if (!profanityValidation.isValid) {
        setError(profanityValidation.errors.join('. '));
        return;
      }

      if (username.trim().length < 3) {
        setError('Username must be at least 3 characters long');
        return;
      }

      if (username.trim().length > 20) {
        setError('Username must be less than 20 characters long');
        return;
      }

      // Check username availability if changed
      if (username.trim() !== initialData.username) {
        const isAvailable = await checkUsernameAvailability(username.trim());
        if (!isAvailable) {
          setError('Username is already taken');
          return;
        }
      }

      // Validate name fields
      if (firstName.trim().length > 50) {
        setError('First name must be less than 50 characters long');
        return;
      }

      if (lastName.trim().length > 50) {
        setError('Last name must be less than 50 characters long');
        return;
      }

      // Save profile
      onSave({
        username: username.trim(),
        firstname: firstName.trim() || null,
        lastname: lastName.trim() || null,
        bgg_username: bggUsername.trim() || null,
      });
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.sheetContainer}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <SFSymbolIcon name="x" />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading || isCheckingUsername}
              accessibilityLabel="Save changes"
              accessibilityRole="button"
            >
              <Save size={20} color={loading ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Username *</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  editable={!loading}
                />
                {isCheckingUsername && (
                  <Text style={styles.checkingText}>Checking availability...</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter first name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  maxLength={50}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter last name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  maxLength={50}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>BGG Username (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={bggUsername}
                  onChangeText={setBggUsername}
                  placeholder="Enter BoardGameGeek username"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={50}
                  editable={!loading}
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.cancelButton, loading && styles.buttonDisabled]}
                  onPress={handleClose}
                  disabled={loading}
                  accessibilityLabel="Cancel"
                  accessibilityRole="button"
                >
                  <Text style={[styles.cancelButtonText, loading && styles.buttonTextDisabled]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButtonLarge, loading && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={loading || isCheckingUsername}
                  accessibilityLabel="Save changes"
                  accessibilityRole="button"
                >
                  <Text style={[styles.saveButtonText, loading && styles.buttonTextDisabled]}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: any, typography: any, touchTargets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: colors.background,
    marginTop: '10%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title2,
    color: colors.text,
  },
  saveButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  form: {
    paddingTop: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: typography.fontSize.body,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.text,
    backgroundColor: colors.card,
    minHeight: 44,
  },
  checkingText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: colors.errorBackground || '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.error,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
  },
  cancelButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.text,
  },
  saveButtonLarge: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});
