import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { ArrowLeft, User, UserPlus } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';
import { validateProfileFields } from '@/utils/profanityFilter';

export default function RegisterProfileScreen() {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResume, setIsResume] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight, isDesktop } = useDeviceType();

  useEffect(() => {
    // Check if we have params (new registration) or if user is authenticated (resume)
    if (params.email && params.password) {
      // New registration flow with params (userId no longer passed from register screen)
      setIsResume(false);
    } else {
      // Check if user is authenticated (resume flow)
      const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert(
            'Access Denied',
            'Please complete your registration from the beginning.',
            [{ text: 'OK', onPress: () => router.replace('/auth/register') }]
          );
          return;
        }
        // User is authenticated, allow them to complete profile
        setIsResume(true);
      };
      checkAuth();
    }
  }, [params, router]);

  const handleCreateAccount = async () => {
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

      // Check if username is available (treat not found as available)
      const { data: existingUser, error: userCheckError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim())
        .maybeSingle();

      if (userCheckError && userCheckError.code !== 'PGRST116') {
        // PGRST116 is PostgREST not found; ignore that
        console.error('Username availability check error:', userCheckError);
      }

      if (existingUser) {
        setError('Username is already taken');
        return;
      }

      // Get user ID for profile creation
      let userId: string;
      if (isResume) {
        // Resume flow - get current user ID
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Session expired. Please sign in again.');
          return;
        }
        userId = user.id;
      } else {
        // New registration flow - create auth user now
        const email = params.email as string;
        const password = params.password as string;

        if (!email || !password) {
          setError('Missing registration information. Please start over.');
          return;
        }

        // Create the auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: Platform.OS === 'web' ? window.location.origin : 'klack://auth/callback',
            data: {
              email_confirm: true,
            },
          },
        });

        if (authError) {
          console.log('Auth error:', authError);

          // Check if email already exists - might be an incomplete registration
          if (authError.status === 422 ||
            authError.message.includes('already registered') ||
            authError.message.includes('User already registered') ||
            authError.message.includes('duplicate key value')) {

            // Try to sign in with the credentials to check for incomplete profile
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (signInError) {
              // Can't sign in - might be wrong password or other issue
              setError('This email is already registered with a different password. Please try logging in or use password reset.');
              return;
            }

            // Successfully signed in - check if profile exists
            if (signInData.user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('id', signInData.user.id)
                .maybeSingle();

              if (profile && profile.username) {
                // Complete profile exists
                setError('Account already exists and is complete. Please sign in instead.');
                return;
              }

              // Incomplete profile - allow them to complete it
              console.log('Found incomplete registration, allowing profile completion');
              userId = signInData.user.id;
            } else {
              setError('Failed to create account. Please try again.');
              return;
            }
          } else if (authError.status === 400) {
            setError('Invalid request. Please check your input and try again.');
            return;
          } else if (authError.status === 429) {
            setError('Too many attempts. Please wait a moment and try again.');
            return;
          } else if (authError.status && typeof authError.status === 'number' && authError.status >= 500) {
            setError('Server error. Please try again later.');
            return;
          } else {
            setError(authError.message || 'Failed to create account. Please try again.');
            return;
          }
        } else if (authData.user) {
          userId = authData.user.id;
        } else {
          setError('Failed to create account. Please try again.');
          return;
        }
      }

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username.trim(),
          firstname: firstName.trim() || null,
          lastname: lastName.trim() || null,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        setError('Failed to create profile. Please try again.');
        return;
      }

      Toast.show({
        type: 'success',
        text1: 'Profile Created!',
        text2: 'Welcome to Klack!',
      });

      // Delay redirect slightly to show toast
      setTimeout(() => {
        router.replace('/collection');
      }, 1500);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Unexpected Error',
        text2: err instanceof Error ? err.message : 'Something went wrong.',
      });
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    console.log('Back button pressed, isResume:', isResume, 'loading:', loading);

    if (isResume) {
      // Resume flow - user can go back to login since they're already authenticated
      console.log('Resume flow: navigating to login');
      router.replace('/auth/login');
    } else {
      // New registration flow - try to go back to register page
      console.log('New registration flow: navigating to register');
      router.push('/auth/register'); // Explicitly navigate to register page
    }
  };

  const styles = getStyles(colors, typography, isDark);

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top} style={{ flex: 1 }}>
      <View style={styles.container}>
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
              {isResume ? 'Complete Your Registration' : 'Complete Profile'}
            </Text>
            {isResume && (
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
                  accessibilityLabel="Username"
                  accessibilityHint="Enter a unique username"
                />
              </View>
            </View>

            <View style={styles.nameRow}>
              <View style={[styles.inputContainer, styles.nameInput]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.inputRealName}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  textContentType="givenName"
                  accessibilityLabel="First name"
                  accessibilityHint="Optional"
                />
              </View>
              <View style={[styles.inputContainer, styles.nameInput]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.inputRealName}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  textContentType="familyName"
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
              onPress={handleCreateAccount}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={loading ? 'Creating account' : 'Create account'}
              accessibilityHint="Creates your profile and continues"
            >
              <UserPlus color={colors.card} size={20} />
              <Text style={styles.createButtonText}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.backButton, loading && styles.buttonDisabled]}
              onPress={handleBack}
              disabled={loading}
              hitSlop={touchTargets.standard}
              accessibilityRole="button"
              accessibilityLabel="Back"
              accessibilityHint="Go back to sign in"
            >
              <ArrowLeft color={colors.textMuted} size={20} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.loginText}>
              By clicking "Create Account" you agree to our{' '}
              <Text
                style={styles.signInText}
                onPress={() => Linking.openURL('/PRIVACY_POLICY.html')}
                accessibilityLabel="Privacy Policy"
                accessibilityRole="button"
                accessibilityHint="Opens Klack's privacy policy in your browser"
              >
                privacy policy
              </Text>
              {' '}and acknowledge that you have read our{' '}
              <Text
                style={styles.signInText}
                onPress={() => Linking.openURL('/TERMS_OF_SERVICE.html')}
                accessibilityLabel="Terms of Service"
                accessibilityRole="button"
                accessibilityHint="Opens Klack's terms of service in your browser"
              >
                terms of service
              </Text>
              .
            </Text>

            {/* <Link href="/auth/login" asChild>
              <TouchableOpacity style={styles.loginLink} hitSlop={touchTargets.standard}>
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.signInText}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </Link> */}
          </View>
        </View>
      </View>
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
    flexDirection: 'row',
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
    marginLeft: 8,
  },
  backButton: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 44,
  },
  backButtonText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.callout,
    fontFamily: typography.getFontFamily('semibold'),
    marginLeft: 8,
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
