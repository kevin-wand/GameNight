import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/services/supabase';
import { useTheme } from '@/hooks/useTheme';
import { useDeviceType } from '@/hooks/useDeviceType';

export default function ResetPasswordHandler() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [statusMessage, setStatusMessage] = useState('Processing password reset...');
  const { colors, typography, touchTargets, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  const styles = getStyles(colors, typography);

  const addLog = (message: string) => {
    console.log(message);
    // Only show logs in development
    if (__DEV__) {
      setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    }
  };

  useEffect(() => {
    const handleReset = async () => {
      addLog('🔍 Processing password reset...');

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Extract URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const allParams: Record<string, string> = {};
        urlParams.forEach((value, key) => allParams[key] = value);
        hashParams.forEach((value, key) => allParams[key] = value);

        addLog(`🔑 Parameters: ${Object.keys(allParams).join(', ')}`);

        if (allParams.error) {
          addLog(`❌ Error: ${allParams.error} (${allParams.error_code || 'no_code'})`);
          setStatus('error');
          setStatusMessage('Invalid reset link. Please request a new one.');
          setTimeout(() => {
            router.replace(`/auth/reset-password?error=${allParams.error}`);
          }, 2000);
          return;
        }

        // Process based on available tokens
        if (allParams.access_token) {
          addLog('✅ Using implicit flow');
          await handleImplicitFlow(allParams);
        } else if (allParams.code) {
          addLog('✅ Using PKCE flow');
          await handlePKCEFlow(allParams.code);
        } else {
          addLog('❌ No valid tokens found');
          setStatus('error');
          setStatusMessage('No valid reset tokens found. Please use the link from your email.');
          setTimeout(() => {
            router.replace('/auth/reset-password?error=no_tokens');
          }, 2000);
        }
      }
    };

    const handleImplicitFlow = async (params: Record<string, string>) => {
      try {
        addLog('🔧 Setting up session...');

        const { data, error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token || params.access_token
        });

        if (error) {
          addLog(`❌ setSession failed: ${error.message}`);
          router.replace('/auth/reset-password?error=session_failed');
          return;
        }

        if (data.session) {
          addLog(`✅ Session created for ${data.user?.email}`);
          setStatus('success');
          setStatusMessage('Reset link verified! Redirecting to password update...');
          setTimeout(() => {
            router.replace('/auth/update-password');
          }, 1500);
        } else {
          addLog('❌ Session creation failed');
          setStatus('error');
          setStatusMessage('Session creation failed. Please try again.');
          setTimeout(() => {
            router.replace('/auth/reset-password?error=no_session');
          }, 2000);
        }
      } catch (err) {
        addLog(`💥 Implicit flow error: ${err}`);
        router.replace('/auth/reset-password?error=unexpected_error');
      }
    };

    const handlePKCEFlow = async (code: string) => {
      try {
        addLog('🔧 Exchanging code for session...');

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          addLog(`❌ exchangeCodeForSession failed: ${error.message}`);
          router.replace('/auth/reset-password?error=code_exchange_failed');
          return;
        }

        if (data.session) {
          addLog(`✅ PKCE session created for ${data.user?.email}`);
          setStatus('success');
          setStatusMessage('Reset link verified! Redirecting to password update...');
          setTimeout(() => {
            router.replace('/auth/update-password');
          }, 1500);
        } else {
          addLog('❌ PKCE session creation failed');
          setStatus('error');
          setStatusMessage('Session creation failed. Please try again.');
          setTimeout(() => {
            router.replace('/auth/reset-password?error=no_pkce_session');
          }, 2000);
        }
      } catch (err) {
        addLog(`💥 PKCE flow error: ${err}`);
        router.replace('/auth/reset-password?error=pkce_error');
      }
    };

    handleReset();
  }, [router]);

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 20} style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={[styles.contentWrapper, { paddingTop: insets.top + 20 }]}>
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
            <Text style={styles.formTitle}>Processing Password Reset</Text>
            <Text style={styles.formSubtitle}>{statusMessage}</Text>

            <View style={styles.statusContainer}>
              {status === 'processing' && (
                <View style={styles.statusItem}>
                  <ActivityIndicator size="large" color={colors.accent} />
                  <Text style={styles.statusText}>Verifying reset link...</Text>
                </View>
              )}

              {status === 'success' && (
                <View style={styles.statusItem}>
                  <SFSymbolIcon name="checkcircle" />
                  <Text style={styles.statusText}>Reset link verified!</Text>
                </View>
              )}

              {status === 'error' && (
                <View style={styles.statusItem}>
                  <XCircle color={colors.error} size={32} />
                  <Text style={styles.statusText}>Verification failed</Text>
                </View>
              )}
            </View>

            {__DEV__ && logs.length > 0 && (
              <View style={styles.logContainer}>
                <Text style={styles.logTitle}>Debug Logs:</Text>
                {logs.map((log, index) => (
                  <Text key={index} style={styles.logText}>
                    {log}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: Math.max(360, Math.min(520, (typeof window !== 'undefined' ? window.innerHeight : 700) * 0.6)),
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
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusItem: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  logContainer: {
    backgroundColor: colors.tints.neutral,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    maxHeight: 200,
  },
  logTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption1,
    color: colors.text,
    marginBottom: 8,
  },
  logText: {
    fontSize: typography.fontSize.caption2,
    color: colors.textMuted,
    marginBottom: 4,
    fontFamily: typography.getFontFamily('normal'),
  },
});