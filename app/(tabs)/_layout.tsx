import 'react-native-reanimated';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useEffect, useState, useMemo } from 'react';
import { saveLastVisitedTab, getLastVisitedTab } from '@/utils/storage';
import { useAccessibilityContext } from '@/contexts/AccessibilityContext';
import { useTheme } from '@/hooks/useTheme';

const EVENTS_SCREEN = false; // Set to true to show events screen

const getHeaderTitle = (routeName: string): string => {
  switch (routeName) {
    case 'collection':
      return 'My Collection';
    case 'index':
      return 'Game Tools';
    case 'events':
      return 'Schedule Events';
    case 'polls':
      return 'Game Polls';
    case 'profile':
      return 'User Profile';
    default:
      return 'Klack';
  }
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [initialTab, setInitialTab] = useState<string | null>(null);
  const { colorScheme } = useAccessibilityContext();
  const { colors, typography, touchTargets } = useTheme();

  // Use fallback values for web platform
  const safeAreaBottom = Platform.OS === 'web' ? 0 : insets.bottom;

  const styles = useMemo(() => getStyles(colors, typography, touchTargets, safeAreaBottom, insets), [colors, typography, touchTargets, safeAreaBottom, insets]);

  useEffect(() => {
    // Load the last visited tab on component mount
    const loadLastTab = async () => {
      const lastTab = await getLastVisitedTab();
      if (lastTab) {
        setInitialTab(lastTab);
      } else {
        // If no last tab is saved, default to collection and save it
        setInitialTab('collection');
        saveLastVisitedTab('collection');
      }
    };
    loadLastTab();
  }, []);

  const handleTabPress = (tabName: string) => {
    // Save the current tab when user switches tabs
    saveLastVisitedTab(tabName);
  };

  // Simple header component
  const CustomHeader = ({ title }: { title: string }) => (
    <View style={styles.customHeader}>
      <Text style={styles.customHeaderTitle}>{title}</Text>
    </View>
  );

  return (
    <Tabs
      initialRouteName="collection"
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: Math.max(8, safeAreaBottom),
            height: 60 + Math.max(8, safeAreaBottom),
            // Enhanced touch targets for mobile
            ...(Platform.OS !== 'web' && {
              paddingTop: 8,
              minHeight: 60 + Math.max(8, safeAreaBottom)
            })
          }
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        header: ({ route }) => <CustomHeader title={getHeaderTitle(route.name)} />,
      }}
      screenListeners={{
        tabPress: (e) => {
          // Get the tab name from the event target
          const routeName = e.target;

          // Try to extract tab name from the route
          let tabName = 'collection'; // default

          if (routeName) {
            // Try different approaches to extract the tab name
            const routeParts = routeName.split('/');
            const lastPart = routeParts[routeParts.length - 1];

            // Check if the last part is a valid tab name
            if (['collection', 'index', 'polls', 'profile'].includes(lastPart)) {
              tabName = lastPart;
            } else {
              // Fallback to string matching
              if (routeName.includes('collection')) tabName = 'collection';
              else if (routeName.includes('index') || routeName.includes('tools')) tabName = 'index';
              else if (routeName.includes('polls')) tabName = 'polls';
              else if (routeName.includes('profile')) tabName = 'profile';
            }
          }

          handleTabPress(tabName);
        },
      }}>
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          tabBarIcon: ({ color, size }) => (
            <SFSymbolIcon name="library" />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tools',
          tabBarIcon: ({ color, size }) => (
            <SFSymbolIcon name="wrench" />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <SFSymbolIcon name="calendar" />
          ),
        }}
      />
      <Tabs.Screen
        name="polls"
        options={{
          title: 'Organize',
          tabBarIcon: ({ color, size }) => (
            <SFSymbolIcon name="vote" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <SFSymbolIcon name="user" />
          ),
        }}
      />
    </Tabs>
  );
}

function getStyles(colors: any, typography: any, touchTargets: any, safeAreaBottom: number, insets: any) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: '#1a2b5f', // Keep exact same color
      borderTopWidth: 0,
      elevation: 0,
      paddingTop: 8,
    },
    tabBarLabel: {
      fontFamily: typography.getFontFamily('medium'),
      fontSize: typography.fontSize.caption2,
    },
    customHeader: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1a2b5f', // Keep exact same color
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: Math.max(12, insets.top), // Use safe area insets instead of hardcoded iOS value
      minHeight: touchTargets.standard.height,
    },
    customHeaderTitle: {
      color: '#ffffff', // Keep exact same color
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title2,
    },
  });
}