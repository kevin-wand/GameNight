import { Stack, useRouter } from 'expo-router';
import { Platform, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

export default function ToolsLayout() {
  const { colors, typography } = useTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.card,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: typography.getFontFamily('semibold'),
          fontSize: typography.fontSize.headline,
        },
        headerLeft: Platform.OS === 'web'
          ? undefined
          : () => (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/' as any)}
                accessibilityRole="button"
                accessibilityLabel="Back to Tools"
                accessibilityHint="Returns to the tools page"
                hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                style={{ paddingHorizontal: 8 }}
              >
                <ChevronLeft size={24} color={colors.card} />
              </TouchableOpacity>
            ),
        headerBackTitle: Platform.OS === 'ios' ? 'Tools' : '',
        presentation: 'card',
        animation: 'slide_from_right',
        // Navigation and accessibility props
        gestureEnabled: true, // Enable swipe gestures for navigation
        gestureDirection: 'horizontal', // Natural swipe direction
      }}
    >
      <Stack.Screen
        name="first-player"
        options={{
          title: 'First Player Select',
          headerShown: true,
          headerBackTitle: Platform.OS === 'ios' ? 'Tools' : '',
        }}
      />
      <Stack.Screen
        name="digital-dice"
        options={{
          title: 'Digital Dice',
          headerShown: true,
          headerBackTitle: Platform.OS === 'ios' ? 'Tools' : '',
        }}
      />
      <Stack.Screen
        name="score-tracker"
        options={{
          title: 'Score Tracker',
          headerShown: true,
          headerBackTitle: Platform.OS === 'ios' ? 'Tools' : '',
        }}
      />
    </Stack>
  );
}