import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const styles = getStyles(colors, typography, isDark);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setCheckingAuth(true);

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setError('Authentication error. Please try the reset link again.');
          return;
        }

        if (session && session.user) {
          console.log('Valid session found for user:', session.user.id);
          setIsAuthenticated(true);
        } else {
          console.log('No valid session found, checking for URL parameters');

          // Fallback: Check for authentication tokens in URL parameters
          let access_token: string | null = null;
          let refresh_token: string | null = null;

          if (Platform.OS === 'web') {
            // Web platform: check URL parameters
            try {
              const urlParams = new URLSearchParams(
                typeof window !== 'undefined' ? window.location.search : ''
              );
              access_token = urlParams.get('access_token');
              refresh_token = urlParams.get('refresh_token');
            } catch (error) {
              console.warn('Could not parse URL parameters:', error);
            }
          } else {
            // Mobile platform: check for deep link parameters
            const initialURL = await Linking.getInitialURL();
            if (initialURL) {
              const url = new URL(initialURL);
              access_token = url.searchParams.get('access_token');
              refresh_token = url.searchParams.get('refresh_token');
            }
          }

          if (access_token) {
            console.log('Found access token in URL, setting session');
            // Set the session with the tokens from URL
            const { error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || access_token
            });

            if (sessionError) {
              console.error('Error setting session:', sessionError);
              setError('Invalid reset link. Please request a new password reset.');
            } else {
              console.log('Session established from URL parameters');
              setIsAuthenticated(true);
            }
          } else {
            console.log('No valid session or tokens found');
            setError('No valid session found. Please use the password reset link from your email.');
          }
        }
      } catch (err) {
        console.error('Error checking auth status:', err);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setCheckingAuth(false);
      }
    };

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, !!session);
      if (event === 'SIGNED_IN' && session) {
        setIsAuthenticated(true);
        setCheckingAuth(false);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });

    checkAuthStatus();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (checkingAuth) {
    return (
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 20} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={[styles.contentWrapper, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoText}>👥</Text>
                </View>
                <Text style={styles.title}>Klack</Text>
              </View>
              <Text style={styles.subtitle}>
                The ultimate tool for organizing your next game night
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Verifying Reset Link</Text>
              <Text style={styles.formSubtitle}>
                Please wait while we verify your password reset link...
              </Text>

              <View style={styles.statusContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.statusText}>Verifying...</Text>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (!isAuthenticated) {
    return (
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 20} style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={[styles.contentWrapper, { paddingTop: insets.top + 20 }]}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <View style={styles.logoIcon}>
                  <Text style={styles.logoText}>👥</Text>
                </View>
                <Text style={styles.title}>Klack</Text>
              </View>
              <Text style={styles.subtitle}>
                The ultimate tool for organizing your next game night
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Reset Link Required</Text>
              <Text style={styles.formSubtitle}>
                {error || 'Please use the password reset link from your email to access this page.'}
              </Text>

              <TouchableOpacity
                style={styles.button}
                hitSlop={touchTargets.standard}
                onPress={() => router.replace('/auth/reset-password')}
                accessibilityLabel="Request new reset link"
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>Request New Reset Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                hitSlop={touchTargets.standard}
                onPress={() => router.replace('/auth/login')}
                accessibilityLabel="Back to login"
                accessibilityRole="button"
              >
                <SFSymbolIcon name="arrow-left" />
                <Text style={styles.backText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const validatePassword = (pwd: string) => {
    if (pwd.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (pwd.length > 72) {
      return 'Password must be less than 72 characters';
    }
    return null;
  };

  const handleUpdatePassword = async () => {
    // Add haptic feedback for mobile
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Validation
    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }

    if (!confirmPassword.trim()) {
      setError('Please confirm your password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      console.log('Updating user password');

      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Password update error:', error);
        setError(error.message);
        Toast.show({
          type: 'error',
          text1: 'Update Failed',
          text2: error.message
        });
      } else if (data.user) {
        console.log('Password updated successfully for user:', data.user.id);
        setSuccess(true);
        Toast.show({
          type: 'success',
          text1: 'Password Updated',
          text2: 'You can now log in with your new password.'
        });

        // Clear the session after successful password update
        setTimeout(async () => {
          await supabase.auth.signOut();
          router.replace('/auth/login?message=password_updated');
        }, 2000);
      }
    } catch (err) {
      console.error('Unexpected error updating password:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password';
      setError(errorMessage);
      Toast.show({
        type: 'error',
        text1: 'Unexpected Error',
        text2: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 20} style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={[styles.contentWrapper, { paddingTop: insets.top + 20 }]}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Text style={styles.logoText}>👥</Text>
              </View>
              <Text style={styles.title}>Klack</Text>
            </View>
            <Text style={styles.subtitle}>
              The ultimate tool for organizing your next game night
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Set New Password</Text>
            <Text style={styles.formSubtitle}>Enter your new password below</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrapper}>
                {/* <Lock color={colors.textMuted} size={20} style={styles.inputIcon} /> */}
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  accessibilityLabel="New password"
                  accessibilityHint="Enter your new password"
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
                {/* <Lock color={colors.textMuted} size={20} style={styles.inputIcon} /> */}
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="new-password"
                  accessibilityLabel="Confirm password"
                  accessibilityHint="Confirm your new password"
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
              <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
            )}

            {success && (
              <View style={styles.successContainer}>
                <SFSymbolIcon name="checkcircle" />
                <Text style={styles.successText}>Password updated! Redirecting to login...</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              hitSlop={touchTargets.standard}
              onPress={handleUpdatePassword}
              disabled={loading}
              accessibilityLabel={loading ? "Updating password" : "Update password"}
              accessibilityRole="button"
            >
              <Lock color={colors.card} size={20} />
              <Text style={styles.buttonText}>
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              hitSlop={touchTargets.standard}
              onPress={() => router.replace('/auth/login')}
              accessibilityLabel="Back to login"
              accessibilityRole="button"
            >
              <SFSymbolIcon name="arrow-left" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: Math.max(380, Math.min(540, (typeof window !== 'undefined' ? window.innerHeight : 700) * 0.6)),
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  formSubtitle: {
    fontFamily: typography.getFontFamily('normal'),
    textAlign: 'center',
    marginBottom: 32,
    color: colors.textMuted,
    fontSize: typography.fontSize.body,
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
    marginLeft: 8,
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
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tints.success,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  successIcon: {
    marginRight: 8,
  },
  successText: {
    fontFamily: typography.getFontFamily('normal'),
    color: colors.success,
    fontSize: typography.fontSize.caption1,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: colors.tints.neutral,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  backText: {
    fontFamily: typography.getFontFamily('semibold'),
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: typography.fontSize.callout,
  },
});