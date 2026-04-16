import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, ScrollView, Image } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  const styles = getStyles(colors, typography, isDark, screenHeight);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Basic validation
      if (!email || !password) {
        setError('Please fill in all fields');
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.log('Auth error:', authError);

        // Handle specific error cases by status code
        if (authError.status === 400) {
          setError('Invalid email or password. Please check your credentials.');
          return;
        } else if (authError.status === 429) {
          setError('Too many attempts. Please wait a moment and try again.');
          return;
        } else if (authError.status && typeof authError.status === 'number' && authError.status >= 500) {
          setError('Server error. Please try again later.');
          return;
        } else if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials.');
          return;
        } else {
          setError(authError.message || 'Failed to sign in. Please try again.');
          return;
        }
      }

      // After login, enforce profile completion (username required)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile || !profile.username) {
          router.replace({ pathname: '/auth/register-profile', params: { userId: user.id } });
          return;
        }
      }
      router.replace('/collection');
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Something went wrong');
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
              <Text style={styles.formTitle}>Log In</Text>
              <Text style={styles.formSubtitle}>Sign in to your account</Text>

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
                    placeholder="Enter your password"
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

              {error && (
                <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                hitSlop={touchTargets.standard}
                onPress={handleLogin}
                disabled={loading}
                accessibilityLabel={loading ? "Signing in" : "Sign in"}
                accessibilityRole="button"
              >
                <LogIn color={colors.card} size={20} />
                <Text style={styles.buttonText}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </TouchableOpacity>

              <Link href="/auth/reset-password" asChild>
                <TouchableOpacity style={styles.forgotPasswordLink} hitSlop={touchTargets.standard}>
                  <Text style={styles.forgotPasswordText}>
                    Forgot your password?
                  </Text>
                </TouchableOpacity>
              </Link>

              <Link href="/auth/register" asChild>
                <TouchableOpacity style={styles.registerLink} hitSlop={touchTargets.standard}>
                  <Text style={styles.registerText}>
                    Don't have an account? <Text style={styles.signInText}>Create one</Text>
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
  forgotPasswordLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontFamily: typography.getFontFamily('normal'),
    color: colors.primary,
    fontSize: typography.fontSize.caption1,
    textDecorationLine: 'underline',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    fontFamily: typography.getFontFamily('normal'),
    color: colors.textMuted,
    fontSize: typography.fontSize.caption1,
  },
  signInText: {
    fontFamily: typography.getFontFamily('semibold'),
    color: colors.primary,
  },
});