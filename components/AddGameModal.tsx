import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { AddImageModal } from './AddImageModal';
import { AddResultsModal } from './AddResultsModal';
import { useAddGameModalFlow } from '@/hooks/useAddGameModalFlow';
import { GameSearchModal } from './GameSearchModal';
import { SyncModal } from './SyncModal';
import { Game } from '@/types/game';
import { supabase } from '@/services/supabase';
import { fetchGames } from '@/services/bggApi';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';

const sampleImage1 = require('@/assets/images/sample-game-1.png');

interface AddGameModalProps {
  isVisible: boolean;
  onClose: () => void;
  onGameAdded: () => void;
  userCollectionIds?: string[];
}

export const AddGameModal: React.FC<AddGameModalProps> = ({
  isVisible,
  onClose,
  onGameAdded,
  userCollectionIds = [],
}) => {
  const router = useRouter();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [fullSizeImageVisible, setFullSizeImageVisible] = useState(false);
  const [fullSizeImageSource, setFullSizeImageSource] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [savedBggUsername, setSavedBggUsername] = useState<string | null>(null);

  const {
    modalState,
    modalActions,
  } = useAddGameModalFlow();

  const styles = useMemo(() => getStyles(colors, typography, insets), [colors, typography, insets]);

  // Load saved BGG username from profile
  useEffect(() => {
    const loadBggUsername = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('bgg_username')
            .eq('id', user.id)
            .maybeSingle();

          setSavedBggUsername(profileData?.bgg_username || null);
        }
      } catch (err) {
        console.error('Error loading BGG username:', err);
      }
    };

    if (isVisible) {
      loadBggUsername();
    }
  }, [isVisible]);

  const showFullSizeImage = (imageSource: any) => {
    setFullSizeImageSource(imageSource);
    setFullSizeImageVisible(true);
  };

  const hideFullSizeImage = () => {
    setFullSizeImageVisible(false);
    setFullSizeImageSource(null);
  };

  const handleImageAnalysisComplete = (imageData: { uri: string; name: string; type: string }, analysisResults?: any) => {
    modalActions.setImageData(imageData);
    if (analysisResults) {
      modalActions.setAnalysisResults(analysisResults);
    }
    modalActions.next();
  };

  const handleCloseModal = () => {
    modalActions.reset();
    onClose();
    announceForAccessibility('Add game modal closed');
  };

  const handleBackToSelect = () => {
    modalActions.back();
  };

  const handleGameAdded = (game: Game) => {
    onGameAdded();
    setSearchModalVisible(false);
  };

  const handleUpdateProfile = async (username: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ bgg_username: username })
        .eq('id', user.id);

      if (error) throw error;

      // Update local state
      setSavedBggUsername(username);
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  const handleSync = async (username: string) => {
    try {
      setSyncing(true);
      setSyncError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/auth/login');
        return;
      }

      if (!username || !username.trim()) {
        setSyncError('Please enter a valid BoardGameGeek username');
        return;
      }

      username = username.replace('@', ''); // Requested in GAM-134 ("Ignore @ when people enter BGG ID")
      const bggGames = await fetchGames(username);

      if (!bggGames || bggGames.length === 0) {
        setSyncError('No games found in collection. Make sure your collection is public and contains board games.');
        return;
      }

      // Create a Map to store unique games, using bgg_game_id as the key
      const uniqueGames = new Map();

      // Only keep the last occurrence of each game ID
      bggGames.forEach(game => {
        uniqueGames.set(game.id, {
          user_id: user.id,
          bgg_game_id: game.id,
          name: game.name,
          thumbnail: game.thumbnail,
          min_players: game.min_players,
          max_players: game.max_players,
          playing_time: game.playing_time,
          minplaytime: game.minPlaytime,
          maxplaytime: game.maxPlaytime,
          year_published: game.yearPublished,
          description: game.description,
        });
      });

      // Convert the Map values back to an array
      const uniqueGamesList = Array.from(uniqueGames.values());

      const { error: insertError } = await supabase
        .from('collections')
        .upsert(uniqueGamesList, { onConflict: 'user_id,bgg_game_id' });

      if (insertError) throw insertError;

      // Refresh the games list and show success message
      onGameAdded();

      Toast.show({ type: 'success', text1: 'Collection imported!' });
      setSyncModalVisible(false);
    } catch (err) {
      console.error('Error in handleSync:', err);
      setSyncError(err instanceof Error ? err.message : 'Failed to sync games');
    } finally {
      setSyncing(false);
    }
  };

  const renderSelectStep = () => (
    <View style={styles.dialog}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Game(s)</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleCloseModal}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
          accessibilityHint="Closes the add game modal"
          hitSlop={touchTargets.sizeTwenty}
        >
          <SFSymbolIcon name="x" />
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        Search for games to add to your collection
      </Text>

      <View style={styles.buttonsContainer}>
        <View style={styles.analyzeContainer}>
          <View style={styles.sampleImageContainer}>
            <TouchableOpacity
              style={styles.sampleImageTouchable}
              onPress={() => {
                showFullSizeImage(sampleImage1);
                announceForAccessibility('Opening sample image in full size');
              }}
              accessibilityLabel="View sample image"
              accessibilityRole="button"
              accessibilityHint="Opens the sample image in full size view"
            >
              <Image source={sampleImage1} style={styles.sampleImage} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.analyzeButton}
            onPress={() => {
              modalActions.next();
              announceForAccessibility('Opening photo analysis modal');
            }}
            accessibilityLabel="Add games with a photo"
            accessibilityRole="button"
            accessibilityHint="Opens camera to take a photo of board games"
            hitSlop={touchTargets.standard}
          >
            <SFSymbolIcon name="camera" color="#fff" />
            <Text style={styles.analyzeButtonText}>Add Games With A Photo</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            setSearchModalVisible(true);
            announceForAccessibility('Opening game search modal');
          }}
          accessibilityLabel="Search for games"
          accessibilityRole="button"
          accessibilityHint="Opens search modal to find and add games"
          hitSlop={touchTargets.small}
        >
          <SFSymbolIcon name="search" color="#fff" />
          <Text style={styles.searchButtonText}>Search for Games</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => {
            setSyncModalVisible(true);
            announceForAccessibility('Opening BGG sync modal');
          }}
          accessibilityLabel="Sync with BoardGameGeek"
          accessibilityRole="button"
          accessibilityHint="Opens modal to sync your BoardGameGeek collection"
          hitSlop={touchTargets.small}
        >
          <SFSymbolIcon name="refresh" color="#fff" />
          <Text style={styles.syncButtonText}>Import from BGG</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Full-size image modal
  const fullSizeImageModal = (
    <Modal
      visible={fullSizeImageVisible}
      transparent
      animationType="fade"
      onRequestClose={hideFullSizeImage}
    >
      <TouchableOpacity
        style={styles.fullSizeOverlay}
        activeOpacity={1}
        onPress={hideFullSizeImage}
      >
        <TouchableOpacity
          style={styles.fullSizeImageContainer}
          activeOpacity={1}
          onPress={hideFullSizeImage}
        >
          <Image
            source={fullSizeImageSource}
            style={styles.fullSizeImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.fullSizeCloseButton}
            onPress={() => {
              hideFullSizeImage();
              announceForAccessibility('Sample image closed');
            }}
            accessibilityLabel="Close full size image"
            accessibilityRole="button"
            accessibilityHint="Closes the full size image view"
            hitSlop={touchTargets.sizeTwenty}
          >
            <SFSymbolIcon name="x" color="#ffffff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const content = (() => {
    switch (modalState.step) {
      case 'select':
        return renderSelectStep();
      case 'image':
        return (
          <AddImageModal
            isVisible={true}
            onClose={handleCloseModal}
            onNext={handleImageAnalysisComplete}
            onBack={handleBackToSelect}
          />
        );
      case 'results':
        return (
          <AddResultsModal
            isVisible={true}
            onClose={handleCloseModal}
            onBack={handleBackToSelect}
            imageData={modalState.imageData || null}
            analysisResults={modalState.analysisResults || null}
            onGamesAdded={onGameAdded}
          />
        );
      default:
        return renderSelectStep();
    }
  })();

  if (Platform.OS === 'web') {
    if (!isVisible) return null;
    return (
      <>
        <View style={styles.webOverlay}>
          {content}
        </View>
        {fullSizeImageModal}
        <GameSearchModal
          isVisible={searchModalVisible}
          onClose={() => setSearchModalVisible(false)}
          mode="collection"
          onGameAdded={handleGameAdded}
          userCollectionIds={userCollectionIds}
          title="Add to Collection"
          searchPlaceholder="Search for games..."
        />
        <SyncModal
          isVisible={syncModalVisible}
          onClose={() => setSyncModalVisible(false)}
          onSync={handleSync}
          onUpdateProfile={handleUpdateProfile}
          loading={syncing}
          savedBggUsername={savedBggUsername}
        />
      </>
    );
  }

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.overlay}>
          {content}
        </View>
      </Modal>
      {fullSizeImageModal}
      <GameSearchModal
        isVisible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        mode="collection"
        onGameAdded={handleGameAdded}
        userCollectionIds={userCollectionIds}
        title="Add to Collection"
        searchPlaceholder="Search for games..."
      />
      <SyncModal
        isVisible={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onSync={handleSync}
        onUpdateProfile={handleUpdateProfile}
        loading={syncing}
        savedBggUsername={savedBggUsername}
      />
    </>
  );
};

const getStyles = (colors: any, typography: any, insets: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Math.max(20, insets.top),
    paddingBottom: Math.max(20, insets.bottom),
    paddingHorizontal: 20,
  },
  webOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingVertical: 0,
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.headline,
    color: colors.text,
  },
  description: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.footnote,
    color: colors.textMuted,
    marginBottom: 8,
  },
  analyzeContainer: {
    marginBottom: 8,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  analyzeButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.subheadline,
    color: colors.card,
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: colors.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.footnote,
    color: colors.card,
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: colors.textMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  syncButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.footnote,
    color: colors.card,
    marginLeft: 8,
  },
  sampleImageContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  sampleImageTouchable: {
    width: 200,
    height: 200,
    overflow: 'hidden',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: colors.border,
    marginBottom: 8,
  },
  sampleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  fullSizeOverlay: {
    flex: 1,
    backgroundColor: colors.tints.neutral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullSizeImageContainer: {
    position: 'relative',
    width: '90%',
    height: '80%',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fullSizeImage: {
    width: '100%',
    height: '100%',
  },
  fullSizeCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: colors.tints.neutral,
    borderRadius: 20,
    padding: 8,
  },
  buttonsContainer: {
    flexDirection: 'column',
  },
});