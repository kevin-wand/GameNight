import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useAccessibilityContext } from '@/contexts/AccessibilityContext';

import { supabase } from '@/services/supabase';
import EditProfileModal from '@/components/EditProfileModal';

const discordSymbolLight = require('@/assets/images/Discord-Symbol-Blurple.svg');
const discordSymbolDark = require('@/assets/images/Discord-Symbol-Blurple.svg');
const bggLogoLight = require('@/assets/images/powered-by-bgg-rgb.svg');
const bggLogoDark = require('@/assets/images/powered-by-bgg-reversed-rgb.svg');

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    username: string;
    firstname: string | null;
    lastname: string | null;
    bgg_username: string | null;
  } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const { colors, typography, isDark } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const { toggleTheme } = useAccessibilityContext();
  const styles = useMemo(() => getStyles(colors, typography), [colors, typography]);

  // Use fallback values for web platform
  const safeAreaBottom = Platform.OS === 'web' ? 0 : insets.bottom;
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loadUserData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setEmail(user.email ?? null);

      // Load profile data
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('username, firstname, lastname, bgg_username')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
      } else if (profileData) {
        setProfile(profileData);
      }
    } else {
      router.replace('/auth/login');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      announceForAccessibility('Successfully signed out');
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnBGG = () => {
    Linking.openURL('https://boardgamegeek.com');
  };

  const handleProfileUpdate = async (updatedProfile: {
    username: string;
    firstname: string | null;
    lastname: string | null;
    bgg_username: string | null;
  }) => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: updatedProfile.username,
          firstname: updatedProfile.firstname,
          lastname: updatedProfile.lastname,
          bgg_username: updatedProfile.bgg_username,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setProfile(updatedProfile);
      setShowEditModal(false);
      announceForAccessibility('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      announceForAccessibility('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 + safeAreaBottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarLetter}>
            {profile?.username?.charAt(0).toUpperCase() || email.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>
          {profile?.username || email}
        </Text>
        {profile?.firstname || profile?.lastname ? (
          <Text style={styles.fullName}>
            {[profile.firstname, profile.lastname].filter(Boolean).join(' ')}
          </Text>
        ) : null}
        {profile?.username && (
          <Text style={styles.email}>
            {email}
          </Text>
        )}
        <TouchableOpacity
          style={styles.editButton}
          accessibilityLabel="Edit profile"
          accessibilityRole="button"
          accessibilityHint="Opens the edit profile form"
          onPress={() => setShowEditModal(true)}
        >
          <Edit3 size={16} color={colors.primary} />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.themeToggleButton}
          activeOpacity={1}
          accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          accessibilityRole="button"
          accessibilityHint={`Switches to ${isDark ? 'light' : 'dark'} mode`}
          onPress={() => {
            toggleTheme();
            announceForAccessibility(`Switched to ${isDark ? 'light' : 'dark'} mode`);
          }}
        >
          <Text style={styles.themeToggleText}>
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>About this app</Text>
          <Text style={styles.infoText}>
            Manage your board game collection, invite friends to play games, and access key tools to make your board gaming easier and more fun.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Contact & Support</Text>
          <View style={styles.contactContainer}>
            <Text style={styles.contactText}>
              Questions, issues, or feature requests?{'\n'}
              For any support needs, contact klackapp@gmail.com or join our Discord server.
            </Text>
            { /*<TouchableOpacity
              accessibilityLabel="Email support"
              accessibilityRole="button"
              accessibilityHint="Opens your email app to contact support"
              onPress={() => Linking.openURL('mailto:klackapp@gmail.com')}
              style={styles.iconButton}
            >
              <SFSymbolIcon name="mail" />
            </TouchableOpacity> */}
            <TouchableOpacity
              accessibilityLabel="Open Discord server"
              accessibilityRole="button"
              accessibilityHint="Opens the Klack Discord invite link"
              onPress={() => Linking.openURL('https://discord.gg/FPX4hatRK2')}
              style={[styles.iconButton, styles.iconButtonSpacing]}
            >
              <Image
                source={isDark ? discordSymbolDark : discordSymbolLight}
                resizeMode="contain"
                style={styles.discordIcon}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <TouchableOpacity
            style={styles.actionButton}
            accessibilityLabel="Log out"
            accessibilityRole="button"
            accessibilityHint="Logs you out and returns to the login screen"
            onPress={handleLogout}
            disabled={loading}
          >
            <SFSymbolIcon name="logout" />
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              {loading ? 'Logging out...' : 'Log Out'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          accessibilityLabel="View BoardGameGeek website"
          accessibilityRole="button"
          accessibilityHint="Opens boardgamegeek.com in your browser"
          onPress={handleViewOnBGG}
        >
          <Image
            source={isDark ? bggLogoDark : bggLogoLight}
            style={styles.bggLogo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text style={styles.infoText}>
          © 2025 Klack LLC. All rights reserved.
        </Text>
      </View>

      {showEditModal && profile && (
        <EditProfileModal
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileUpdate}
          initialData={profile}
          loading={loading}
        />
      )}
    </ScrollView>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80, // Base padding for tab bar
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarLetter: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title1 * 1.25,
    color: '#ffffff',
  },
  username: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title3,
    color: colors.primary,
    marginBottom: 4,
  },
  fullName: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.textMuted,
    marginBottom: 8,
  },
  email: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.caption1,
    color: colors.textMuted,
    marginBottom: 16,
    opacity: 0.8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  editButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption1,
    color: colors.primary,
    marginLeft: 6,
  },
  themeToggleButton: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  themeToggleText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption1,
    color: colors.primary,
    textAlign: 'center',
  },
  bggLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  bggLinkText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.accent,
    marginRight: 4,
  },
  statsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.success,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoLabel: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.callout,
    color: colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.textMuted,
    lineHeight: 22,
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  contactText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.subheadline,
    color: colors.textMuted,
    lineHeight: 22,
    flex: 1,
  },
  iconButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonSpacing: {
    marginLeft: 12,
  },
  discordIcon: {
    width: 28,
    height: 28,
  },
  bggLogo: {
    width: '100%',
    height: 60,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 44,
  },
  actionButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.primary,
    marginLeft: 12,
  },
  logoutButtonText: {
    color: colors.error,
  },
});