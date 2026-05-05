import { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView, Image, Keyboard, TouchableWithoutFeedback, Linking } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  const styles = getStyles(colors, typography, isDark, screenHeight);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const keyboardAvoidingBehavior =
    Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined;

  const legalPagesBaseUrl = Platform.select({
    web: typeof window !== 'undefined' ? window.location.origin : 'https://klack.netlify.app',
    default: 'https://klack.netlify.app',
  });

  const redirectToProfileCompletion = () => {
    router.push({
      pathname: '/auth/register-profile',
      params: { fromSignup: '1' },
    });
  };

  const ensurePlaceholderProfile = async (userId: string, normalizedEmail: string) => {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          username: normalizedEmail,
          firstname: null,
          lastname: null,
        },
        { onConflict: 'id' }
      );
    return profileError;
  };

  const handleCreateAccount = async () => {
    Keyboard.dismiss();
    try {
      setLoading(true);
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();

      // Basic validation
      if (!normalizedEmail || !password) {
        setError('Please fill in all fields');
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }

      if (password.length > 72) {
        setError('Password must be less than 72 characters');
        return;
      }

      // Password confirmation validation
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        setError('Please enter a valid email address');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: Platform.OS === 'web' ? window.location.origin : 'klack://auth/callback',
          data: {
            email_confirm: true,
          },
        },
      });

      if (authError) {
        const isDuplicate =
          authError.status === 422 ||
          authError.message.includes('already registered') ||
          authError.message.includes('User already registered') ||
          authError.message.includes('duplicate key value');

        if (isDuplicate) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (signInError) {
            setError(
              'This email is already registered with a different password. Please try logging in or use password reset.'
            );
            return;
          }

          if (!signInData.user) {
            setError('Failed to sign in. Please try again.');
            return;
          }

          const userId = signInData.user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('id', userId)
            .maybeSingle();

          const hasRealUsername =
            profile?.username &&
            profile.username.trim().toLowerCase() !== normalizedEmail;

          if (hasRealUsername) {
            setError('Account already exists and is complete. Please sign in instead.');
            return;
          }

          const profileErr = await ensurePlaceholderProfile(userId, normalizedEmail);
          if (profileErr) {
            console.error('Profile placeholder error (duplicate path):', profileErr);
            setError('Could not finish setup. Please try signing in.');
            return;
          }

          redirectToProfileCompletion();
          return;
        }

        if (authError.status === 400) {
          setError('Invalid request. Please check your input and try again.');
          return;
        }
        if (authError.status === 429) {
          setError('Too many attempts. Please wait a moment and try again.');
          return;
        }
        if (authError.status && typeof authError.status === 'number' && authError.status >= 500) {
          setError('Server error. Please try again later.');
          return;
        }
        setError(authError.message || 'Failed to create account. Please try again.');
        return;
      }

      let userId = authData.user?.id ?? null;
      if (!userId) {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      }

      if (!userId) {
        setError('Account could not be created. Please try again or confirm your email if required.');
        return;
      }

      const profileErr = await ensurePlaceholderProfile(userId, normalizedEmail);
      if (profileErr) {
        console.error('Profile placeholder error:', profileErr);
        setError('Account created but profile setup failed. Try signing in to continue.');
        return;
      }

      redirectToProfileCompletion();
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  const screenContent = (
    <View style={styles.container}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <View style={[styles.contentWrapper, { paddingTop: insets.top + 20 }]}>
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <Image
                    source={require('@/assets/images/klack-logo-40x40.png')}
                    resizeMode="contain"
                    style={styles.logoIcon}
                  />
                  <Text style={styles.title}>Klack</Text>
                </View>
              </View>

              <View style={styles.formContainer}>
                <Text style={styles.formTitle}>Create Account</Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    {/* <Mail color={colors.textMuted} size={20} style={styles.inputIcon} /> */}
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email address"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      accessibilityLabel="Email address"
                      accessibilityHint="Enter your email address"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    {/* <Lock color={colors.textMuted} size={20} style={styles.inputIcon} /> */}
                    <TextInput
                      ref={passwordInputRef}
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Choose a password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                      accessibilityLabel="Password"
                      accessibilityHint="Enter your password"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                      hitSlop={touchTargets.standard}
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      accessibilityRole="button"
                    >
                      {showPassword ? (
                        <EyeOff color={colors.textMuted} size={20} />
                      ) : (
                        <Eye color={colors.textMuted} size={20} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      ref={confirmPasswordInputRef}
                      style={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter your password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateAccount}
                      accessibilityLabel="Confirm password"
                      accessibilityHint="Re-enter your password to confirm"
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                      hitSlop={touchTargets.standard}
                      accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
                      accessibilityRole="button"
                    >
                      {showConfirmPassword ? (
                        <EyeOff color={colors.textMuted} size={20} />
                      ) : (
                        <Eye color={colors.textMuted} size={20} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  hitSlop={touchTargets.standard}
                  onPress={handleCreateAccount}
                  disabled={loading}
                  accessibilityLabel={loading ? 'Creating account' : 'Create account'}
                  accessibilityRole="button"
                >
                  <Text style={styles.buttonText}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Text>
                </TouchableOpacity>

                <Link href="/auth/login" asChild>
                  <TouchableOpacity style={styles.loginLink} hitSlop={touchTargets.standard}>
                    <Text style={styles.loginText}>
                      Already have an account? <Text style={styles.signInText}>Sign in</Text>
                    </Text>
                  </TouchableOpacity>
                </Link>

                <Text style={styles.disclaimerText}>
                  By creating an account you agree to our{' '}
                  <Text
                    style={styles.disclaimerLink}
                    onPress={() => Linking.openURL(`${legalPagesBaseUrl}/PRIVACY_POLICY.html`)}
                    accessibilityLabel="Privacy Policy"
                    accessibilityRole="button"
                    accessibilityHint="Opens Klack's privacy policy in your browser"
                  >
                    privacy policy
                  </Text>
                  {' '}and acknowledge that you have read our{' '}
                  <Text
                    style={styles.disclaimerLink}
                    onPress={() => Linking.openURL(`${legalPagesBaseUrl}/TERMS_OF_SERVICE.html`)}
                    accessibilityLabel="Terms of Service"
                    accessibilityRole="button"
                    accessibilityHint="Opens Klack's terms of service in your browser"
                  >
                    terms of service
                  </Text>
                  .
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={keyboardAvoidingBehavior}
      keyboardVerticalOffset={insets.top + 20}
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

const getStyles = (colors: any, typography: any, isDark: boolean, screenHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? colors.background : colors.tints.neutral,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontFamily: typography.getFontFamily('bold'),
    textAlign: 'center',
    marginBottom: 8,
    color: colors.text,
    fontSize: typography.fontSize.title2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontFamily: typography.getFontFamily('semibold'),
    marginBottom: 8,
    color: colors.text,
    fontSize: typography.fontSize.caption1,
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
  input: {
    flex: 1,
    fontFamily: typography.getFontFamily('normal'),
    paddingVertical: 12,
    //paddingHorizontal: 12,
    color: colors.text,
    fontSize: typography.fontSize.footnote,
    backgroundColor: 'transparent',
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 8,
    flexShrink: 0,
  },
  button: {
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
  buttonText: {
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.card,
    fontSize: typography.fontSize.callout,
  },
  errorText: {
    fontFamily: typography.getFontFamily('normal'),
    marginBottom: 12,
    textAlign: 'center',
    color: colors.error,
    fontSize: typography.fontSize.caption1,
  },
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
    fontSize: typography.fontSize.caption1,
  },
  signInText: {
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.primary,
  },
  disclaimerText: {
    marginTop: 20,
    color: colors.textMuted,
    fontSize: typography.fontSize.caption1,
    fontFamily: typography.getFontFamily('normal'),
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.caption1,
  },
  disclaimerLink: {
    color: colors.primary,
    fontFamily: typography.getFontFamily('semibold'),
  },
});