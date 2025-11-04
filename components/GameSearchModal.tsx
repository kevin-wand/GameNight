import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Platform, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus } from 'lucide-react-native';
import { supabase } from '@/services/supabase';
import { debounce } from 'lodash';
import { XMLParser } from 'fast-xml-parser';
import Toast from 'react-native-toast-message';
import { decode } from 'html-entities';

import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';

import { Game } from '@/types/game';

interface GameSearchModalProps {
  isVisible: boolean;
  onClose: () => void;
  mode: 'collection' | 'poll';
  onGameAdded?: (game: Game) => void;
  onGameSelected?: (game: Game) => void;
  title?: string;
  searchPlaceholder?: string;
  existingGameIds?: string[];
  userCollectionIds?: string[];
}

export const GameSearchModal: React.FC<GameSearchModalProps> = ({
  isVisible,
  onClose,
  mode,
  onGameAdded,
  onGameSelected,
  title = 'Search Games',
  searchPlaceholder = 'Search for games...',
  existingGameIds = [],
  userCollectionIds = [],
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const styles = useMemo(() => getStyles(colors, typography, insets, screenHeight), [colors, typography, insets, screenHeight]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [adding, setAdding] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Clear search bar when game is added or modal is closed
  useEffect(() => {
    if (!isVisible) {
      setSearchQuery('');
      setSearchResults([]);
      setError('');
      setSearching(false);
      setAdding(false);
    } else {
      // Auto-focus the search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [isVisible]);


  const fetchSearchResults = useCallback(async (term: string) => {
    try {
      // Perform an API request based on the search term
      let apiHost = '';
      if (typeof window === 'undefined'
        || !window.location.hostname.endsWith('.netlify.app')
      ) {
        apiHost = 'https://klack-dev.netlify.app';
      }
      const response = await fetch(`${apiHost}/.netlify/functions/bgg-api/search?query=${encodeURIComponent(term)}&type=boardgame`);

      const xmlText = await response.text();

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });

      const result = parser.parse(xmlText);

      // No search results returned by API
      if (!result.items || !result.items.item) {
        setSearchResults([]);
      } else {
        const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item];

        const ids = items
          .filter((item: any) => item.name.type === 'primary')
          .map((item: any) => item.id);

        /* We are intentionally sorting by rank in the hopes that
           more relevant results will be displayed first */
        const { data: games } = await supabase
          .from('games')
          .select()
          .in('id', ids)
          .order('rank');

        setSearchResults(games || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Handle the error, e.g., show an error message to the user
    } finally {
      setSearching(false);
    }
  }, []);

  const debouncedSearch = useMemo(() => debounce(fetchSearchResults, 500), [fetchSearchResults]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setError('Please enter a search term');
      return;
    }
    setSearching(true);
    setError('');
    debouncedSearch(text);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError('');

    // Refocus the search input after clearing
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleAddGameToCollection = async (game: Game) => {
    const decodedName = decode(game.name);
    try {
      setAdding(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if the game already exists in the collection
      const { data: existingGames } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('bgg_game_id', game.id);

      if (existingGames && existingGames.length > 0) {
        setError(`${decodedName} is already in your collection`);
        return;
      }

      const { error: insertError } = await supabase
        .from('collections')
        .insert({
          user_id: user.id,
          bgg_game_id: game.id,
          name: game.name,
          thumbnail: game.thumbnail,
          min_players: game.min_players,
          max_players: game.max_players,
          playing_time: game.playing_time,
          year_published: game.yearPublished,
        });

      if (insertError) throw insertError;

      onGameAdded?.(game);
      announceForAccessibility(`${decodedName} added to your collection`);

      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Game Added!',
        text2: `${decodedName} has been added to your collection`,
        visibilityTime: 2000,
        autoHide: true,
      });

      onClose();
    } catch (err) {
      console.error('Add game error:', err);
      setError('Failed to add game to collection');
      announceForAccessibility('Failed to add game to collection');
    } finally {
      setAdding(false);
    }
  };

  const handleSelectGameForPoll = (game: Game) => {
    const decodedName = decode(game.name);
    // Check if game is already in the poll
    if (existingGameIds.includes(game.id.toString())) {
      setError(`${decodedName} is already in the poll`);
      announceForAccessibility(`${decodedName} is already in the poll`);
      return;
    }

    // Check if game is in user's collection
    if (userCollectionIds.includes(game.id.toString())) {
      setError(`${decodedName} is already in your collection`);
      announceForAccessibility(`${decodedName} is already in your collection`);
      return;
    }



    onGameSelected?.(game);

    // Show success message
    setSuccessMessage(`${decodedName} added successfully!`);
    announceForAccessibility(`${decodedName} added successfully`);
    setError('');

    // Clear search state after game is selected but keep modal open
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);

    // Refocus the search input after clearing
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  const handleAction = (game: Game) => {
    if (mode === 'collection') {
      handleAddGameToCollection(game);
    } else {
      handleSelectGameForPoll(game);
    }
  };

  const isActionDisabled = (game: Game) => {
    if (mode === 'collection') {
      return adding || userCollectionIds.includes(game.id.toString());
    } else {
      return existingGameIds.includes(game.id.toString()) || userCollectionIds.includes(game.id.toString());
    }
  };

  const getActionButtonStyle = (game: Game) => {
    if (isActionDisabled(game)) {
      return [styles.actionButton, styles.actionButtonDisabled];
    }
    return styles.actionButton;
  };

  const renderSearchResults = () => (
    <FlatList
      data={searchResults}
      keyExtractor={(item) => item.id.toString()}
      style={styles.resultsList}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <View style={styles.resultItem}>
          <Image
            source={{ uri: item.thumbnail || item.image || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg' }}
            style={styles.thumbnail}
            resizeMode="contain"
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultTitle}>{decode(item.name)}</Text>
            <Text style={styles.resultDetails}>
              {item.min_players}-{item.max_players} players • {item.playing_time} min
              {item.yearPublished && ` • ${item.yearPublished}`}
            </Text>
            {mode === 'collection' && userCollectionIds.includes(item.id.toString()) && (
              <Text style={styles.alreadyInCollection}>Already in collection</Text>
            )}
            {mode === 'poll' && existingGameIds.includes(item.id.toString()) && (
              <Text style={styles.alreadyInPoll}>Already in poll</Text>
            )}
          </View>
          <TouchableOpacity
            style={getActionButtonStyle(item)}
            onPress={() => handleAction(item)}
            disabled={isActionDisabled(item)}
            accessibilityLabel={mode === 'collection' ? `Add ${decode(item.name)} to collection` : `Add ${decode(item.name)} to poll`}
            accessibilityRole="button"
            accessibilityHint={mode === 'collection' ? 'Adds game to your collection' : 'Adds game to the current poll'}
            hitSlop={touchTargets.sizeTwenty}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          {searching ? 'Searching...' : searchQuery ? 'No games found' : 'Enter a search term to find games'}
        </Text>
      }
    />
  );

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => { onClose(); announceForAccessibility('Search modal closed'); }}
              accessibilityLabel="Close search"
              accessibilityRole="button"
              accessibilityHint="Closes the game search modal"
              hitSlop={touchTargets.sizeTwenty}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {mode === 'poll' && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                Warning: Games added via search will only be added to this poll, not to your collection.
              </Text>
            </View>
          )}

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <TextInput
                ref={searchInputRef}
                style={styles.input}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search games"
                accessibilityHint="Type to search for games by name"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={handleClearSearch}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                  accessibilityHint="Clears the current search text"
                  hitSlop={touchTargets.small}
                >
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {successMessage ? (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                {successMessage}
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {renderSearchResults()}
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any, typography: any, insets: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(400, Math.min(550, screenHeight * 0.7));

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Math.max(20, insets.top),
      paddingBottom: Math.max(20, insets.bottom),
      paddingHorizontal: 20,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 500,
      maxHeight: '85%',
      minHeight: responsiveMinHeight,
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
      marginBottom: 16,
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
    },
    description: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.textMuted,
      marginBottom: 20,
    },
    searchContainer: {
      marginBottom: 16,
    },
    searchInputContainer: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingRight: 40, // Make room for clear button
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.card,
      textAlign: 'left',
      width: '100%',
    },
    clearButton: {
      position: 'absolute',
      right: 12,
      padding: 4,
      backgroundColor: colors.background,
      borderRadius: 12,
    },
    errorText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.error,
      marginBottom: 16,
    },
    resultsList: {
      flex: 1,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      padding: 12,
      paddingLeft: 8,
      borderRadius: 12,
      marginBottom: 12,
    },
    resultInfo: {
      flex: 1,
      marginRight: 12,
    },
    resultTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
    },
    resultDetails: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      marginTop: 4,
    },
    alreadyInCollection: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      marginTop: 4,
      fontStyle: 'italic',
    },
    alreadyInPoll: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      marginTop: 4,
      fontStyle: 'italic',
    },
    actionButton: {
      backgroundColor: colors.accent,
      width: 40,
      height: 40,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonDisabled: {
      opacity: 0.5,
      backgroundColor: colors.textMuted,
    },
    emptyText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 20,
    },
    thumbnail: {
      width: 80,
      height: 80,
      borderRadius: 4,
      marginLeft: 0,
      marginRight: 6,
      backgroundColor: colors.background,
    },
    warningContainer: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    warningText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 18,
    },
    successContainer: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    successText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
};
