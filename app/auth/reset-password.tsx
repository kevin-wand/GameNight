import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, MailCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  const styles = getStyles(colors, typography, isDark, screenHeight);

  const getBaseUrl = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin;
    }

    // Fallback for mobile
    return 'https://klack.netlify.app';
  };

  // Check for error parameters from redirects
  useEffect(() => {
    const errorParam = params.error as string;
    if (errorParam) {
      switch (errorParam) {
        case 'invalid_link':
          setError('The password reset link is invalid or has expired. Please request a new one.');
          break;
        case 'no_tokens':
          setError('No valid reset tokens found. Please use the link from your email.');
          break;
        case 'unexpected_error':
          setError('An unexpected error occurred. Please try again.');
          break;
        case 'missing_session':
          setError('Authentication session expired. Please request a new reset link.');
          break;
        default:
          setError('Something went wrong. Please try again.');
      }
    }
  }, [params.error]);

  const handleResetPassword = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      // Basic validation
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }

      // Clear any existing session before sending reset email
      await supabase.auth.signOut();

      const redirectUrl = `${getBaseUrl()}/auth/update-password`;
      console.log('Sending reset email with redirect URL:', redirectUrl);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Reset password error:', error);

        // Handle specific error cases
        if (error.status === 400) {
          setError('Invalid email address. Please check your input.');
          return;
        } else if (error.status === 429) {
          setError('Too many attempts. Please wait a moment and try again.');
          return;
        } else if (error.status && typeof error.status === 'number' && error.status >= 500) {
          setError('Server error. Please try again later.');
          return;
        } else if (error.message.includes('Invalid email')) {
          setError('Please enter a valid email address.');
          return;
        } else {
          setError(error.message || 'Failed to send reset email. Please try again.');
          return;
        }
      } else {
        setSuccess(true);
        Toast.show({
          type: 'success',
          text1: 'Reset Email Sent',
          text2: 'Check your inbox for instructions.'
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
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
              <Text style={styles.formTitle}>Reset Password</Text>
              <Text style={styles.formSubtitle}>Enter your email to receive a password reset link</Text>

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
                    autoComplete="email"
                    accessibilityLabel="Email address"
                    accessibilityHint="Enter your email address to receive reset link"
                  />
                </View>
              </View>

              {error && (
                <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
              )}

              {success && (
                <View style={styles.successContainer}>
                  {/* <MailCheck color={colors.success} size={20} style={styles.successIcon} /> */}
                  <Text style={styles.successText}>Reset email sent! Check your inbox.</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                hitSlop={touchTargets.standard}
                onPress={handleResetPassword}
                disabled={loading}
                accessibilityLabel={loading ? "Sending reset email" : "Send reset link"}
                accessibilityRole="button"
              >
                {/* <MailCheck color={colors.card} size={20} /> */}
                <Text style={styles.buttonText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                hitSlop={touchTargets.standard}
                onPress={() => router.replace('/auth/login')}
                accessibilityLabel="Back to login"
                accessibilityRole="button"
              >
                <ArrowLeft color={colors.textMuted} size={20} />
                <Text style={styles.backText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
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