import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon, { SFSymbolIconProps } from '@/components/SFSymbolIcon';
interface ToolsFooterProps {
  currentScreen?: string;
}

export default function ToolsFooter({ currentScreen }: ToolsFooterProps) {
  const { colors, typography, touchTargets } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Use fallback values for web platform
  const safeAreaBottom = Platform.OS === 'web' ? 0 : insets.bottom;

  const navigationItems = useMemo(() => [
    {
      id: 'collections',
      label: 'Collection',
      icon: "library",
      route: '/(tabs)/collection',
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: "wrench",
      route: '/(tabs)/',
    },
    {
      id: 'events',
      label: 'Events',
      icon: "calendar",
      route: '/(tabs)/events',
    },
    {
      id: 'polls',
      label: 'Organize',
      icon: "vote",
      route: '/(tabs)/polls',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: "user",
      route: '/(tabs)/profile',
    },
  ], []);

  const styles = useMemo(() => getStyles(colors, typography, touchTargets, safeAreaBottom), [colors, typography, touchTargets, safeAreaBottom]);

  return (
    <View style={styles.footer}>
      {navigationItems.map((item) => {
        const isActive = currentScreen === item.id;

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              isActive && styles.navItemActive,
            ]}
            onPress={() => router.push(item.route as any)}
            hitSlop={touchTargets.standard}
            accessibilityLabel={`Navigate to ${item.label}`}
            accessibilityRole="button"
            accessibilityHint={`Opens the ${item.label} screen`}
          >
            <View style={styles.navIcon}>
              <SFSymbolIcon name={item.icon as SFSymbolIconProps['name']} size={25} color={isActive ? colors.accent : colors.textMuted} />
            </View>
            <Text
              style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function getStyles(colors: any, typography: any, touchTargets: any, safeAreaBottom: number) {
  return StyleSheet.create({
    footer: {
      backgroundColor: '#1a2b5f', // Match exact color from _layout.tsx
      borderTopWidth: 0,
      elevation: 0,
      paddingTop: 8,
      paddingBottom: Math.max(8, safeAreaBottom),
      height: 60 + Math.max(8, safeAreaBottom),
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      // Enhanced touch targets for mobile - match _layout.tsx exactly
      ...(Platform.OS !== 'web' && {
        paddingTop: 8,
        minHeight: 60 + Math.max(8, safeAreaBottom)
      })
    },
    navItem: {
      flex: 1, // Allow items to expand and fill available space
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4, // Reduced horizontal padding for better spacing
      minHeight: 44, // Standard touch target
      justifyContent: 'center',
      // Add max width to prevent items from getting too wide on large screens
      maxWidth: 120,
    },
    navItemActive: {
      // Remove background highlight to match main app
    },
    navIcon: {
      marginBottom: 1, // Increased to push icons down
      paddingTop: 5,
    },
    navLabel: {
      fontFamily: typography.getFontFamily('medium'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted, // Use theme color to match _layout.tsx exactly
      textAlign: 'center',
      marginTop: 0, // Push text down slightly
    },
    navLabelActive: {
      color: colors.accent, // Use theme color to match _layout.tsx exactly
      fontFamily: typography.getFontFamily('medium'),
    },
  });
}
