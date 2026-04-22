import 'react-native-get-random-values';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import Toast from 'react-native-toast-message';
import { initializeSafariFixes, persistSessionInSafari } from '@/utils/safari-polyfill';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ModalSurfaceProvider } from '@/contexts/ModalSurfaceContext';
import { RootErrorBoundary } from '@/components/RootErrorBoundary';
import '../styles/globals.css';

export default function RootLayout() {
  useFrameworkReady();
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    // Initialize Safari compatibility fixes
    initializeSafariFixes();
    persistSessionInSafari();
  }, []);

  // Apply dark mode class to document for web
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [colorScheme]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AccessibilityProvider>
        <SafeAreaProvider>
          <ModalSurfaceProvider>
            <RootErrorBoundary>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="(tabs)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
              </Stack>
              <Toast />
              <StatusBar
                style={colorScheme === 'dark' ? 'light' : 'dark'}
                backgroundColor={colorScheme === 'dark' ? '#1a2b5f' : '#ffffff'}
              />
            </RootErrorBoundary>
          </ModalSurfaceProvider>
        </SafeAreaProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}