import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { User } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';
import { validateProfileFields } from '@/utils/profanityFilter';
import { showRegisterProfileExitToast } from '@/utils/profileUsernamePlaceholder';

export default function RegisterProfileScreen() {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ fromSignup?: string; userId?: string }>();
  const fromSignup = params.fromSignup === '1';
  const fromLoginIncomplete = Boolean(params.userId) && !fromSignup;
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useDeviceType();
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);

  const keyboardAvoidingBehavior =
    Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(
          'Access Denied',
          'Please complete your registration from the beginning.',
          [{ text: 'OK', onPress: () => router.replace('/auth/register') }]
        );
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, firstname, lastname')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      setUsername(profile?.username ?? '');
      setFirstName(profile?.firstname ?? '');
      setLastName(profile?.lastname ?? '');
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCompleteProfile = async () => {
    Keyboard.dismiss();
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!username.trim()) {
        setError('Username is required');
        return;
      }

      // Check for profanity in all fields
      const profanityValidation = validateProfileFields(username, firstName, lastName);
      if (!profanityValidation.isValid) {
        setError(profanityValidation.errors.join('. '));
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Session expired. Please sign in again.');
        return;
      }

      const trimmedUsername = username.trim();

      const { data: existingRow, error: userCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        console.error('Username availability check error:', userCheckError);
      }

      if (existingRow && existingRow.id !== user.id) {
        setError('Username is already taken');
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            username: trimmedUsername,
            firstname: firstName.trim() || null,
            lastname: lastName.trim() || null,
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        console.error('Profile update error:', profileError);
        setError('Failed to save profile. Please try again.');
        return;
      }

      await showRegisterProfileExitToast(user.id, 'saved');

      setTimeout(() => {
        router.replace('/collection');
      }, 900);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unexpected Error',
        text2: err instanceof Error ? err.message : 'Something went wrong.',
      });
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditLater = async () => {
    Keyboard.dismiss();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/auth/register');
      return;
    }
    await showRegisterProfileExitToast(user.id, 'skipped');
    router.replace('/collection');
  };

  const styles = getStyles(colors, typography, isDark);

  const screenContent = (
    <View style={styles.container}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={[styles.contentWrapper, { paddingTop: insets.top }]}>
              {/*<View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>👥</Text>
              </View>
              <Text style={styles.title}>Klack</Text>
            </View>
            <Text style={styles.subtitle}>
              The ultimate tool for organizing your next game night
            </Text>
          </View>*/}

              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>
                  {fromSignup ? 'Edit Profile' : 'Complete Your Registration'}
                </Text>
                {fromLoginIncomplete && (
                  <Text style={styles.resumeMessage}>
                    Welcome back! Please complete your profile to finish setting up your account.
                  </Text>
                )}
                <Text style={styles.formSubtitle}>Tell us a bit about yourself</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Username *</Text>
                  <View style={styles.inputWrapper}>
                    <User color={colors.textMuted} size={20} style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputUsername}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Choose a username"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="username"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => firstNameInputRef.current?.focus()}
                      accessibilityLabel="Username"
                      accessibilityHint="Enter a unique username"
                    />
                  </View>
                </View>

                <View style={styles.nameRow}>
                  <View style={[styles.inputContainer, styles.nameInput]}>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                      ref={firstNameInputRef}
                      style={styles.inputRealName}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      textContentType="givenName"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => lastNameInputRef.current?.focus()}
                      accessibilityLabel="First name"
                      accessibilityHint="Optional"
                    />
                  </View>
                  <View style={[styles.inputContainer, styles.nameInput]}>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                      ref={lastNameInputRef}
                      style={styles.inputRealName}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Optional"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="words"
                      textContentType="familyName"
                      returnKeyType="done"
                      onSubmitEditing={handleCompleteProfile}
                      accessibilityLabel="Last name"
                      accessibilityHint="Optional"
                    />
                  </View>
                </View>

                {!isDesktop && <View style={styles.spacer} />}

                {/* <TouchableOpacity
              style={styles.privacyNotice}
              onPress={() => setPrivacyExpanded(!privacyExpanded)}
              accessibilityRole="button"
              accessibilityLabel={privacyExpanded ? "Collapse privacy notice" : "Expand privacy notice"}
              accessibilityHint="Tap to show or hide privacy information"
            >
              <Text style={styles.privacyHeader}>Privacy Notice</Text>
              {privacyExpanded && (
                <View>
                  <Text style={styles.privacyText}>
                    Your real name information may be visible to other users of the platform.
                  </Text>
                  <Text style={styles.privacyText}>
                    Your email address will always remain private and will not be shared with other users.
                  </Text>
                </View>
              )}
            </TouchableOpacity> */}

                {error && (
                  <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
                )}

                <TouchableOpacity
                  style={[styles.createButton, loading && styles.buttonDisabled]}
                  onPress={handleCompleteProfile}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={loading ? 'Saving profile' : 'Complete profile'}
                  accessibilityHint="Saves your profile and goes to your collection"
                >
                  <Text style={styles.createButtonText}>
                    {loading ? 'Saving...' : 'Complete Profile'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backButton, loading && styles.buttonDisabled]}
                  onPress={handleEditLater}
                  disabled={loading}
                  hitSlop={touchTargets.standard}
                  accessibilityRole="button"
                  accessibilityLabel="Edit later"
                  accessibilityHint="Skips saving and opens your collection"
                >
                  <Text style={styles.backButtonText}>Edit Later</Text>
                </TouchableOpacity>

                {/* <Link href="/auth/login" asChild>
              <TouchableOpacity style={styles.loginLink} hitSlop={touchTargets.standard}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.signInText}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </Link> */}
              </View>
            </View>
          </ScrollView>
        </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      keyboardVerticalOffset={insets.top}
      style={{ flex: 1 }}
    >
      {Platform.OS === 'web' ? (
        screenContent
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {screenContent}
        </TouchableWithoutFeedback>
      )}
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, typography: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? colors.background : colors.tints.neutral,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    minHeight: Math.max(380, Math.min(560, (typeof window !== 'undefined' ? window.innerHeight : 700) * 0.62)),
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 0,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: colors.card,
  },
  logoText: {
    fontSize: 20,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    color: colors.text,
    fontSize: typography.fontSize.title1,
  },
  subtitle: {
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 22,
    maxWidth: 280,
    color: colors.text,
    fontSize: typography.fontSize.body,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 32,
    // Slightly taller minHeight for profile fields
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  formSubtitle: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  resumeMessage: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: colors.tints.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption1,
    color: colors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    minHeight: 48,
    overflow: 'hidden',
  },
  inputIcon: {
    marginRight: 12,
  },
  inputUsername: {
    flex: 1,
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.text,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  inputRealName: {
    flex: 1,
    fontSize: typography.fontSize.footnote,
    fontFamily: typography.getFontFamily('normal'),
    color: colors.text,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 12,
    minHeight: 48,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  nameInput: {
    flex: 1,
    marginRight: 4,
  },
  spacer: {
    height: 16,
  },
  privacyNotice: {
    paddingRight: 16,
    paddingBottom: 0,
    marginBottom: 16,
  },
  privacyHeader: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption1,
    color: isDark ? colors.warning : colors.text,
    textDecorationLine: 'underline',
    marginBottom: 0,
  },
  privacyText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: isDark ? colors.warning : colors.text,
    marginBottom: 8,
    lineHeight: typography.lineHeight.normal * typography.fontSize.caption1,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: colors.card,
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('semibold'),
  },
  backButton: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44,
  },
  backButtonText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('semibold'),
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('normal'),
    marginBottom: 12,
    textAlign: 'center',
  },
  loginLink: {
    alignItems: 'center',
  },
  loginText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('normal'),
  },
  signInText: {
    color: colors.primary,
    fontFamily: typography.getFontFamily('semibold'),
  },
});
