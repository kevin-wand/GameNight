//On Android, test if the keyboard covers the form when the user taps on a text input - we can add behavior="height" to handle the issue

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView, Image } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
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

  const handleContinue = async () => {
    try {
      setLoading(true);
      setError(null);

      // Basic validation
      if (!email || !password) {
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
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      // Validation passed - proceed to profile completion
      // Auth user creation will happen on the next screen
      router.push({
        pathname: '/auth/register-profile',
        params: {
          email,
          password,
        }
      });
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
                <Image
                  source={require('@/assets/images/klack-logo-40x40.png')}
                  resizeMode="contain"
                  style={styles.logoIcon}
                />
                <Text style={styles.title}>Klack</Text>
              </View>
              <Text style={styles.subtitle}>
                The ultimate tool for organizing your next game night
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.formTitle}>Create Account</Text>
              <Text style={styles.formSubtitle}>Enter your email and password to get started</Text>

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
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Choose a password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
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
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirmPassword}
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
                onPress={handleContinue}
                disabled={loading}
                accessibilityLabel={loading ? "Validating account" : "Continue to profile setup"}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Validating...' : 'Continue'}
                </Text>
                <ArrowRight color={colors.card} size={20} />
              </TouchableOpacity>

              <Link href="/auth/login" asChild>
                <TouchableOpacity style={styles.loginLink} hitSlop={touchTargets.standard}>
                  <Text style={styles.loginText}>
                    Already have an account? <Text style={styles.signInText}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
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
    paddingBottom: 20,
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
  formSubtitle: {
    fontFamily: typography.getFontFamily('normal'),
    textAlign: 'center',
    marginBottom: 16,
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
    marginRight: 8,
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
});