import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity, ScrollView, TextInput, Platform, Image, ImageStyle, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useCallback } from 'react';
import { decode } from 'html-entities';

import { CreatePollDetails } from './CreatePollDetails';
import { CreatePollAddOptions } from './CreatePollAddOptions';
import { FilterGameModal } from './FilterGameModal';
import { GameSearchModal } from './GameSearchModal';
import { PollSuccessModal } from './PollSuccessModal';
import { FilterState, useGameFilters } from '@/utils/filterOptions';
import { sortGamesByTitle } from '@/utils/sortingUtils';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';

import { Game } from '@/types/game';

interface CreatePollModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (pollType: 'single-user' | 'multi-user-device' | 'add-games', addedGames?: Game[]) => void;
  preselectedGames?: Game[];
  initialFilters?: FilterState;
  isAddingToExistingPoll?: boolean;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
  preselectedGames,
  initialFilters,
  isAddingToExistingPoll = false,
}) => {
  const router = useRouter();
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchAddedGames, setSearchAddedGames] = useState<Game[]>([]);
  const [selectedGamesForPoll, setSelectedGamesForPoll] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollTitle, setPollTitle] = useState('');
  const [defaultTitle, setDefaultTitle] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  // Modal states
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);
  const [isAdditionalOptionsModalVisible, setIsAdditionalOptionsModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isGameSearchModalVisible, setIsGameSearchModalVisible] = useState(false);
  const [isPollCreatedModalVisible, setIsPollCreatedModalVisible] = useState(false);
  const [createdPollUrl, setCreatedPollUrl] = useState('');

  // TODO: Re-add filter state in Phase 3
  // Filter states - arrays for UI selections (legacy shape maintained for now)
  // const [playerCount, setPlayerCount] = useState<FilterOption[]>([]);
  // const [playTime, setPlayTime] = useState<FilterOption[]>([]);
  // const [minAge, setMinAge] = useState<FilterOption[]>([]);
  // const [gameType, setGameType] = useState<FilterOption[]>([]);
  // const [complexity, setComplexity] = useState<FilterOption[]>([]);

  // Centralized range-based filters (Phase 3 integration)
  const {
    filters,
    setFilters,
    clearFilters: clearAllFilters,
    applyFilters,
    isFiltered,
  } = useGameFilters(initialFilters); // Initialize with collection's filters!
  // ].some(_ => _.length);

  const styles = useMemo(() => getStyles(colors, typography, insets, screenHeight), [colors, typography, insets, screenHeight]);

  // Filter options imported from utils/filterOptions.ts

  useEffect(() => {
    if (isVisible) {
      loadGames();
      if (preselectedGames && preselectedGames.length > 0) {
        setSelectedGames(preselectedGames);
      }
      // TODO: Re-add initial filters logic in Phase 3
      // Apply initial filters if provided
      // if (initialFilters) {
      //   setPlayerCount(initialFilters.playerCount);
      //   setPlayTime(initialFilters.playTime);
      //   setMinAge(initialFilters.minAge);
      //   setGameType(initialFilters.gameType);
      //   setComplexity(initialFilters.complexity);
      // }
    }
  }, [isVisible, initialFilters]);

  // TODO: Re-add filtering logic in Phase 3
  // Apply centralized filtering when inputs change
  // useEffect(() => {
  //   // Start with available games and remove those added via search to avoid duplicates
  //   const baseList = availableGames.filter(game =>
  //     !searchAddedGames.some(searchGame => searchGame.id === game.id)
  //   );

  //   // Convert legacy arrays to range-based state and apply
  //   const converted = convertLegacyFiltersToState({
  //     playerCount,
  //     playTime,
  //     minAge,
  //     gameType,
  //     complexity,
  //   });
  //   setRangeFilters(converted);
  //   // Use enhanced filtering with bucket unions for time and age
  //   const filtered = filterGamesWithBuckets(baseList, converted, playTime, minAge);
  //   setFilteredGames(filtered);
  //   // Don't automatically remove selected games when filters change
  // }, [availableGames, searchAddedGames, playerCount, playTime, minAge, gameType, complexity, setRangeFilters]);

  // Apply filters to available games
  useEffect(() => {
    const baseList = availableGames.filter(game =>
      !searchAddedGames.some(searchGame => searchGame.id === game.id)
    );
    const filtered = applyFilters(baseList);
    setFilteredGames(filtered);
  }, [availableGames, searchAddedGames, applyFilters]);

  // Update default title when selected games change
  useEffect(() => {
    // Count games that are selected for the poll via checkboxes
    const totalSelectedGames = selectedGamesForPoll.length;

    let newDefaultTitle = '';
    if (totalSelectedGames === 1) {
      newDefaultTitle = 'Vote on 1 game';
    } else if (totalSelectedGames > 1) {
      newDefaultTitle = `Vote on ${totalSelectedGames} games`;
    }
    setDefaultTitle(newDefaultTitle);
    if (totalSelectedGames === 0) {
      // Reset to empty when no games are selected
      setPollTitle('');
    } else if ((!pollTitle || pollTitle.startsWith('Vote on')) && newDefaultTitle) {
      setPollTitle(newDefaultTitle);
    }
  }, [selectedGamesForPoll]);

  const loadGames = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('expansions_players_view')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error;

      const games = data.map(game => ({
        id: game.bgg_game_id,
        name: game.name,
        yearPublished: game.year_published,
        thumbnail: game.thumbnail || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg',
        image: game.image_url || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg',
        min_players: game.min_players,
        max_players: game.max_players,
        playing_time: game.playing_time,
        minPlaytime: game.minplaytime,
        maxPlaytime: game.maxplaytime,
        description: game.description,
        minAge: game.min_age,
        is_cooperative: game.is_cooperative,
        is_teambased: game.is_teambased,
        complexity: game.complexity,
        complexity_tier: game.complexity_tier,
        complexity_desc: game.complexity_desc,
        average: game.average,
        bayesaverage: game.bayesaverage ?? null,
        min_exp_players: game.min_exp_players,
        max_exp_players: game.max_exp_players,
        expansions: [], // Add empty expansions array to match Game interface
      }));

      // Sort games alphabetically by title, ignoring articles
      const sortedGames = sortGamesByTitle(games);
      setAvailableGames(sortedGames);
      setFilteredGames(sortedGames);
    } catch (err) {
      console.error('Error loading games:', err);
      setError('Failed to load games');
    }
  };

  const handleAddGames = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use selectedGamesForPoll which contains the combined checked games
      const allSelectedGames = [...selectedGamesForPoll];

      if (allSelectedGames.length === 0) {
        setError('Please select at least one game to add.');
        setLoading(false);
        return;
      }

      // Filter out games that are already in the poll (preselectedGames)
      const newGames = allSelectedGames.filter(game =>
        !preselectedGames?.some(preselected => preselected.id === game.id)
      );

      if (newGames.length === 0) {
        setError('All selected games are already in the poll.');
        setLoading(false);
        return;
      }

      // Return the new games to the parent component
      onSuccess('add-games', newGames);
      resetForm();
    } catch (err) {
      console.error('Error adding games:', err);
      setError(err instanceof Error ? err.message : 'Failed to add games');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use selectedGamesForPoll which contains the combined checked games
      const allSelectedGames = [...selectedGamesForPoll];

      if (allSelectedGames.length === 0) {
        setError('Please select at least one game to create a poll.');
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the current poll title (which will be the default if user didn't change it)
      const title = pollTitle.trim();

      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          user_id: user.id,
          title,
          description: pollDescription.trim() || null,
          max_votes: 1,
        })
        .select()
        .single();

      if (pollError) throw pollError;

      const pollGames = allSelectedGames.map(game => ({
        poll_id: poll.id,
        game_id: game.id,
      }));

      const { error: gamesError } = await supabase
        .from('poll_games')
        .insert(pollGames);

      if (gamesError) throw gamesError;

      // Show success modal for new polls, call onSuccess immediately for adding games
      if (!isAddingToExistingPoll) {
        const pollUrl = `${window.location.origin}/poll/${poll.id}/`;
        setCreatedPollUrl(pollUrl);
        setIsPollCreatedModalVisible(true);

        // Don't call onSuccess yet - wait for user to close the success modal
        announceForAccessibility('Poll created successfully');
      } else {
        // For adding games to existing poll, call onSuccess immediately
        onSuccess('add-games', allSelectedGames);
        resetForm();
        announceForAccessibility('Games added to poll successfully');
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedGames([]);
    setSearchAddedGames([]);
    setSelectedGamesForPoll([]);
    setError(null);
    setPollTitle('');
    setPollDescription('');
    clearAllFilters();
    announceForAccessibility('Form reset');
  };

  const toggleGameSelection = (game: Game) => {
    const decodedName = decode(game.name);
    setSelectedGamesForPoll(current => {
      const isSelected = current.some(g => g.id === game.id);
      if (isSelected) {
        announceForAccessibility(`${decodedName} removed from poll`);
        return current.filter(g => g.id !== game.id);
      } else {
        announceForAccessibility(`${decodedName} added to poll`);
        return [...current, game];
      }
    });
  };

  // TODO: Re-add filter change handlers in Phase 3
  // const handlePlayerCountChange = (newValue: any) => {
  //   setPlayerCount(newValue || []);
  // };

  // const handlePlayTimeChange = (newValue: any) => {
  //   setPlayTime(newValue || []);
  // };

  // const handleMinAgeChange = (newValue: any) => {
  //   setMinAge(newValue || []);
  // };

  // const handleGameTypeChange = (newValue: any) => {
  //   setGameType(newValue || []);
  // };

  // const handleComplexityChange = (newValue: any) => {
  //   setComplexity(newValue || []);
  // };

  const handlePollCreatedModalClose = () => {
    setIsPollCreatedModalVisible(false);
    // SIMPLIFIED: Just close the success modal, keep main modal open
  };

  // Add a wrapper for onClose to debug when it's called
  const handleMainModalClose = () => {
    announceForAccessibility('Poll creation cancelled');
    onClose();
    resetForm();
  };

  // Modal handlers
  const handleDetailsSave = (title: string, description: string) => {
    setPollTitle(title);
    setPollDescription(description);
    announceForAccessibility('Poll details saved');
  };


  if (!isVisible) return null;


  const content = (
    <>
      {isAddingToExistingPoll && (
        <TouchableOpacity
          style={styles.absoluteBackButton}
          onPress={() => {
            onClose();
            resetForm();
          }}
          accessibilityLabel="Back to Edit Poll"
          hitSlop={touchTargets.small}
        >
          <SFSymbolIcon name="arrow-left" />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.absoluteCloseButton}
        onPress={handleMainModalClose}
        accessibilityLabel="Close"
        hitSlop={touchTargets.sizeTwenty}
      >
        <SFSymbolIcon name="x" />
      </TouchableOpacity>
      <View style={styles.header}>
        <Text style={styles.title}>
          {isAddingToExistingPoll ? 'Add More Games' : 'Create Poll'}
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={true}
      >
        {!isAddingToExistingPoll && (
          <>
            <View style={styles.titleSection}>
              <TouchableOpacity
                style={[styles.titleButton, pollTitle && styles.titleButtonActive]}
                onPress={() => setIsDetailsModalVisible(true)}
                hitSlop={touchTargets.small}
                accessibilityLabel="Edit poll details"
                accessibilityHint="Opens poll title and description editor"
              >
                <View style={styles.titleButtonContent}>
                  <View style={styles.titleButtonLeft}>
                    <Text style={styles.titleButtonLabel}>Poll Details</Text>
                  </View>
                  <View style={styles.titleButtonRight}>
                    <View style={[styles.titleButtonIndicator, { opacity: pollTitle ? 1 : 0, marginRight: 8 }]}>
                      <Text style={styles.titleButtonIndicatorText}>✓</Text>
                    </View>
                    <SFSymbolIcon name="square-pen" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Additional Options section - hidden for now */}
            {/* <View style={styles.descriptionSection}>
              <TouchableOpacity
                style={[styles.descriptionButton, pollDescription && styles.descriptionButtonActive]}
                onPress={() => setIsAdditionalOptionsModalVisible(true)}
              >
                <View style={styles.descriptionButtonContent}>
                  <View style={styles.descriptionButtonLeft}>
                    <Text style={styles.descriptionButtonLabel}>Additional Options</Text>
                  </View>
                  <View style={styles.descriptionButtonRight}>
                    <View style={[styles.descriptionButtonIndicator, { opacity: pollDescription ? 1 : 0 }]}>
                      <Text style={styles.descriptionButtonIndicatorText}>✓</Text>
                    </View>
                    <SFSymbolIcon name="square-pen" />
                  </View>
                </View>
              </TouchableOpacity>
            </View> */}
          </>
        )}

        <View style={styles.filterSection}>
          <TouchableOpacity
            style={[styles.filterButton, isFiltered && styles.filterButtonActive]}
            onPress={() => setIsFilterModalVisible(true)}
            hitSlop={touchTargets.small}
            accessibilityLabel="Filter games"
            accessibilityHint="Opens game filtering options"
          >
            <View style={styles.filterButtonContent}>
              <View style={styles.filterButtonLeft}>
                <Text style={styles.filterButtonLabel}>Filter Games (Optional)</Text>
              </View>
              <View style={styles.filterButtonRight}>
                <View style={[styles.filterButtonIndicator, { opacity: isFiltered ? 1 : 0 }]}>
                  <Text style={styles.filterButtonIndicatorText}>✓</Text>
                </View>
                <SFSymbolIcon name="listfilter" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          {/* <Text style={styles.sublabel}>
            {isAddingToExistingPoll
              ? 'Add games not in your collection'
              : 'Add games not in your collection to the poll'
            }
          </Text> */}
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsGameSearchModalVisible(true)}
            hitSlop={touchTargets.standard}
            accessibilityLabel="Search for games"
            accessibilityHint="Opens game search modal to find and add games"
          >
            <SFSymbolIcon name="search" color="#fff" />
            <Text style={styles.searchButtonText}>Search for Games</Text>
          </TouchableOpacity>
        </View>

        {/* Collection Games Section */}
        <View style={styles.gamesSection}>
          <View style={styles.gamesHeader}>
            <Text style={styles.label}>Games Selection</Text>
            <View style={styles.gamesHeaderRight}>
              <TouchableOpacity
                style={[styles.selectAllButton, { marginRight: 6 }]}
                onPress={() => {
                  setSelectedGamesForPoll([...filteredGames, ...searchAddedGames]);
                  announceForAccessibility('All games selected');
                }}
                hitSlop={touchTargets.small}
                accessibilityLabel="Select all games"
                accessibilityHint="Selects all available games for the poll"
              >
                <Text style={styles.selectAllButtonText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clearAllButton}
                onPress={() => {
                  setSelectedGamesForPoll([]);
                  announceForAccessibility('All games deselected');
                }}
                hitSlop={touchTargets.small}
                accessibilityLabel="Clear all selections"
                accessibilityHint="Deselects all currently selected games"
              >
                <Text style={styles.clearAllButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Games Added via Search Section */}
        {searchAddedGames.length > 0 && (
          <View style={styles.searchAddedSection}>
            {searchAddedGames.map(game => {
              const decodedName = decode(game.name);
              const useMinExpPlayers = game.min_exp_players && game.min_exp_players < game.min_players;
              const useMaxExpPlayers = game.max_exp_players > game.max_players;
              const minPlayers = useMinExpPlayers ? game.min_exp_players : game.min_players;
              const maxPlayers = useMaxExpPlayers ? game.max_exp_players : game.max_players;
              const playerCountText = (
                maxPlayers > 0
                  ? (
                    <>
                      <Text style={useMinExpPlayers ? styles.infoTextEmphasis : null}>
                        {minPlayers}
                      </Text>
                      {minPlayers !== maxPlayers && (
                        <>
                          <Text>-</Text>
                          <Text style={useMaxExpPlayers ? styles.infoTextEmphasis : null}>
                            {maxPlayers}
                          </Text>
                        </>
                      )}
                      <Text>
                        {` player${maxPlayers === 1 ? '' : 's'}`}
                      </Text>
                    </>
                  ) : (
                    'N/A'
                  )
              );
              const isAlreadyInPoll = preselectedGames?.some(pg => pg.id === game.id);
              return (
                <TouchableOpacity
                  key={`search-${game.id}`}
                  style={[
                    styles.searchAddedGameItem,
                    isAlreadyInPoll && styles.gameItemDisabled
                  ]}
                  onPress={() => !isAlreadyInPoll && toggleGameSelection(game)}
                  disabled={isAlreadyInPoll}
                  hitSlop={touchTargets.small}
                  accessibilityLabel={`${decodedName}${isAlreadyInPoll ? ' (already in poll)' : ''}`}
                  accessibilityHint={isAlreadyInPoll ? 'This game is already in the poll' : 'Tap to select or deselect this game'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedGamesForPoll.some(g => g.id === game.id) }}
                >
                  <Image
                    source={{ uri: game.thumbnail || game.image || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg' }}
                    style={[
                      {
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        backgroundColor: colors.background,
                        marginRight: 8,
                      },
                      isAlreadyInPoll && styles.gameThumbnailDisabled
                    ]}
                    resizeMode="cover"
                  />
                  <View style={styles.gameInfo}>
                    <Text style={[
                      styles.gameName,
                      isAlreadyInPoll && styles.gameNameDisabled
                    ]}>{decodedName}</Text>
                    <Text style={[
                      styles.playerCount,
                      isAlreadyInPoll && styles.playerCountDisabled
                    ]}>
                      {playerCountText} • {game.playing_time ? `${game.playing_time} min` : game.minPlaytime && game.maxPlaytime ? (game.minPlaytime === game.minPlaytime ? `${game.minPlaytime} min` : `${game.minPlaytime}-${game.maxPlaytime} min`) : game.minPlaytime || game.maxPlaytime ? `${game.minPlaytime || game.maxPlaytime} min` : 'Unknown time'}
                    </Text>
                    {isAlreadyInPoll && (
                      <Text style={styles.alreadyInPollText}>Already in poll</Text>
                    )}
                  </View>
                  {/* <TouchableOpacity
                    style={styles.removeSearchGameButton}
                    onPress={() => {
                      // Remove from searchAddedGames
                      setSearchAddedGames(prev => prev.filter(g => g.id !== game.id));
                      // Also remove from selectedGamesForPoll if it was selected
                      setSelectedGamesForPoll(prev => prev.filter(g => g.id !== game.id));
                    }}
                    hitSlop={touchTargets.small}
                  >
                    <SFSymbolIcon name="x" />
                  </TouchableOpacity> */}
                  <View style={[
                    styles.checkbox,
                    selectedGamesForPoll.some(g => g.id === game.id) && styles.checkboxSelected,
                    isAlreadyInPoll && styles.checkboxDisabled
                  ]}>
                    {selectedGamesForPoll.some(g => g.id === game.id) && (
                      <SFSymbolIcon name="check" color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Games List Section */}
        <View style={styles.gamesListSection}>
          {filteredGames.length === 0 ? (
            <Text style={styles.noGamesText}>
              {availableGames.length === 0 ? 'No games found in your collection' : 'No games match your filters'}
            </Text>
          ) : (
            filteredGames.map(game => {
              const decodedName = decode(game.name);
              const isSelected = selectedGamesForPoll.some(g => g.id === game.id);
              const isAlreadyInPoll = preselectedGames?.some(pg => pg.id === game.id);
              const useMinExpPlayers = game.min_exp_players && game.min_exp_players < game.min_players;
              const useMaxExpPlayers = game.max_exp_players > game.max_players;
              const minPlayers = useMinExpPlayers ? game.min_exp_players : game.min_players;
              const maxPlayers = useMaxExpPlayers ? game.max_exp_players : game.max_players;
              const playerCountText = (
                maxPlayers > 0
                  ? (
                    <>
                      <Text style={useMinExpPlayers ? styles.infoTextEmphasis : null}>
                        {minPlayers}
                      </Text>
                      {minPlayers !== maxPlayers && (
                        <>
                          <Text>-</Text>
                          <Text style={useMaxExpPlayers ? styles.infoTextEmphasis : null}>
                            {maxPlayers}
                          </Text>
                        </>
                      )}
                      <Text>
                        {` player${maxPlayers === 1 ? '' : 's'}`}
                      </Text>
                    </>
                  ) : (
                    'N/A'
                  )
              );
              return (
                <TouchableOpacity
                  key={game.id}
                  style={[
                    styles.gameItem,
                    isSelected && styles.gameItemSelected,
                    isAlreadyInPoll && styles.gameItemDisabled
                  ]}
                  onPress={() => !isAlreadyInPoll && toggleGameSelection(game)}
                  disabled={isAlreadyInPoll}
                  hitSlop={touchTargets.small}
                  accessibilityLabel={`${decodedName}${isAlreadyInPoll ? ' (already in poll)' : ''}`}
                  accessibilityHint={isAlreadyInPoll ? 'This game is already in the poll' : 'Tap to select or deselect this game'}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <Image
                    source={{ uri: game.thumbnail || game.image || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg' }}
                    style={[
                      {
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        backgroundColor: colors.background,
                        marginRight: 8,
                      },
                      isAlreadyInPoll && styles.gameThumbnailDisabled
                    ]}
                    resizeMode="cover"
                  />
                  <View style={styles.gameInfo}>
                    <Text style={[
                      styles.gameName,
                      isAlreadyInPoll && styles.gameNameDisabled
                    ]}>{decodedName}</Text>
                    <Text style={[
                      styles.playerCount,
                      isAlreadyInPoll && styles.playerCountDisabled
                    ]}>
                      {playerCountText} • {game.playing_time ? `${game.playing_time} min` : game.minPlaytime && game.maxPlaytime ? (game.minPlaytime === game.minPlaytime ? `${game.minPlaytime} min` : `${game.minPlaytime}-${game.maxPlaytime} min`) : game.minPlaytime || game.maxPlaytime ? `${game.minPlaytime || game.maxPlaytime} min` : 'Unknown time'}
                    </Text>
                    {isAlreadyInPoll && (
                      <Text style={styles.alreadyInPollText}>Already in poll</Text>
                    )}
                  </View>
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                    isAlreadyInPoll && styles.checkboxDisabled
                  ]}>
                    {isSelected && (
                      <SFSymbolIcon name="check" color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.createButton, loading || selectedGamesForPoll.length === 0 ? styles.createButtonDisabled : undefined]}
          onPress={isAddingToExistingPoll ? handleAddGames : handleCreatePoll}
          disabled={loading || selectedGamesForPoll.length === 0}
          hitSlop={touchTargets.standard}
          accessibilityLabel={loading ? (isAddingToExistingPoll ? 'Adding games...' : 'Creating poll...') : (isAddingToExistingPoll ? 'Add selected games to poll' : 'Create poll with selected games')}
          accessibilityHint={selectedGamesForPoll.length === 0 ? 'Select at least one game to continue' : undefined}
        >
          <SFSymbolIcon name="plus" color="#fff" />
          <Text style={styles.createButtonText}>
            {loading ? (isAddingToExistingPoll ? 'Adding...' : 'Creating...') : (isAddingToExistingPoll ? 'Add Games' : 'Create Poll')}
          </Text>
        </TouchableOpacity>
      </View>
    </>
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
        <View style={styles.modalContainer}>
          <View style={[styles.dialog, styles.dialogResponsive]}>
            {content}
          </View>
        </View>
      </View>
      {/* Details Modal */}
      <CreatePollDetails
        isVisible={isDetailsModalVisible}
        onClose={() => setIsDetailsModalVisible(false)}
        onSave={handleDetailsSave}
        currentTitle={pollTitle}
        currentDescription={pollDescription}
      />

      {/* Additional Options Modal */}
      <CreatePollAddOptions
        isVisible={isAdditionalOptionsModalVisible}
        onClose={() => setIsAdditionalOptionsModalVisible(false)}
        onSave={(options) => {
          // Handle additional options when implemented
          console.log('Additional options:', options);
          setIsAdditionalOptionsModalVisible(false);
        }}
      />

      <FilterGameModal
        isVisible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        onApplyFilters={() => setIsFilterModalVisible(false)}
        title="Filter Collection"
        description="All filters (optional)"
        applyButtonText="Apply Filters"
        initialFilters={filters}
        onFiltersChange={setFilters}
      />

      {/* Game Search Modal */}
      <GameSearchModal
        isVisible={isGameSearchModalVisible}
        onClose={() => setIsGameSearchModalVisible(false)}
        mode="poll"
        onGameSelected={(game) => {
          // Add to searchAddedGames and automatically select for poll
          setSearchAddedGames(prev => [...prev, game]);
          setSelectedGamesForPoll(prev => [...prev, game]);
          // Modal stays open so user can add more games
        }}
        existingGameIds={selectedGames.map(g => g.id.toString())}
        userCollectionIds={[]}
        title="Search for Games"
        searchPlaceholder="Enter search..."
      />

      {/* Poll Success Modal */}
      <PollSuccessModal
        isVisible={isPollCreatedModalVisible}
        onClose={handlePollCreatedModalClose}
        onDone={() => {
          // Close both modals and call onSuccess
          setIsPollCreatedModalVisible(false);
          onSuccess('single-user');
          resetForm();
        }}
        pollUrl={createdPollUrl}
        onStartInPersonVoting={() => {
          // Extract poll ID from URL and navigate to the local poll voting page
          const pollId = createdPollUrl.split('/poll/')[1]?.split('/')[0];
          if (pollId) {
            // Use router.push for proper navigation to local voting
            router.push(`/poll/local/${pollId}/`);
          }
        }}
      />
    </Modal>
  );
};

type Styles = {
  overlay: ViewStyle;
  dialog: ViewStyle;
  header: ViewStyle;
  closeButton: ViewStyle;
  title: TextStyle;
  content: ViewStyle;
  titleSection: ViewStyle;
  titleInput: TextStyle;
  titleButton: ViewStyle;
  titleButtonActive: ViewStyle;
  titleButtonContent: ViewStyle;
  titleButtonLeft: ViewStyle;
  titleButtonRight: ViewStyle;
  titleButtonLabel: TextStyle;
  titleButtonIndicator: ViewStyle;
  titleButtonIndicatorText: TextStyle;
  descriptionSection: ViewStyle;
  descriptionInput: TextStyle;
  descriptionButton: ViewStyle;
  descriptionButtonActive: ViewStyle;
  descriptionButtonContent: ViewStyle;
  descriptionButtonLeft: ViewStyle;
  descriptionButtonRight: ViewStyle;
  descriptionButtonLabel: TextStyle;
  descriptionButtonIndicator: ViewStyle;
  descriptionButtonIndicatorText: TextStyle;
  label: TextStyle;
  sublabel: TextStyle;
  filterSection: ViewStyle;
  filterItem: ViewStyle;
  filterButton: ViewStyle;
  filterButtonActive: ViewStyle;
  filterButtonContent: ViewStyle;
  filterButtonLeft: ViewStyle;
  filterButtonRight: ViewStyle;
  filterButtonLabel: TextStyle;
  filterButtonIndicator: ViewStyle;
  filterButtonIndicatorText: TextStyle;
  activeFilters: ViewStyle;
  activeFiltersText: TextStyle;
  clearFiltersButton: ViewStyle;
  searchSection: ViewStyle;
  searchButton: ViewStyle;
  searchButtonText: TextStyle;
  clearButton: ViewStyle;
  dropdown: ViewStyle;
  dropdownScroll: ViewStyle;
  dropdownItem: ViewStyle;
  dropdownItemSelected: ViewStyle;
  dropdownItemText: TextStyle;
  dropdownItemTextSelected: TextStyle;
  searchAddedSection: ViewStyle;
  sectionHeader: ViewStyle;
  sectionLabel: TextStyle;
  clearSearchButton: ViewStyle;
  clearSearchButtonText: TextStyle;
  searchAddedGameItem: ViewStyle;
  searchAddedIndicator: ViewStyle;
  searchAddedIndicatorText: TextStyle;
  removeSearchGameButton: ViewStyle;
  gamesSection: ViewStyle;
  gamesListSection: ViewStyle;
  gamesHeader: ViewStyle;
  gamesHeaderLeft: ViewStyle;
  gamesHeaderRight: ViewStyle;
  selectAllButton: ViewStyle;
  selectAllButtonText: TextStyle;
  clearAllButton: ViewStyle;
  clearAllButtonText: TextStyle;
  gameItem: ViewStyle;
  gameItemSelected: ViewStyle;
  gameThumbnail: ViewStyle;
  gameInfo: ViewStyle;
  gameName: TextStyle;
  playerCount: TextStyle;
  checkbox: ViewStyle;
  checkboxSelected: ViewStyle;
  noGamesText: TextStyle;
  errorText: TextStyle;
  createButton: ViewStyle;
  createButtonDisabled: ViewStyle;
  createButtonText: TextStyle;
  scrollContent: ViewStyle;
  footer: ViewStyle;
  absoluteBackButton: ViewStyle;
  absoluteCloseButton: ViewStyle;
  optionRow: ViewStyle;
  optionText: TextStyle;
  optionTextSelected: TextStyle;
  gameItemDisabled: ViewStyle;
  gameThumbnailDisabled: ImageStyle;
  gameNameDisabled: TextStyle;
  playerCountDisabled: TextStyle;
  alreadyInPollText: TextStyle;
  checkboxDisabled: ViewStyle;
  infoTextEmphasis: TextStyle;
  modalContainer: ViewStyle;
  dialogResponsive: ViewStyle;
};

const getStyles = (colors: any, typography: any, insets: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(500, Math.min(650, screenHeight * 0.75));

  return StyleSheet.create<Styles>({
    overlay: {
      flex: 1,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: Math.max(16, insets.top),
      paddingBottom: Math.max(16, insets.bottom),
      paddingHorizontal: 16,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 8,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      paddingHorizontal: 12,
      maxHeight: '85%',
      minHeight: responsiveMinHeight,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 24,
      position: 'relative',
      marginHorizontal: 0,
      paddingBottom: 8,
    },
    closeButton: {
      padding: 4,
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginTop: 8,
    },
    content: {
      paddingVertical: 16,
    },
    scrollContent: {
      paddingBottom: 0,
      paddingTop: 0,
      paddingHorizontal: 0,
    },
    titleSection: {
      marginBottom: 0,
      width: '100%',
      paddingTop: 4,
    },
    titleInput: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    titleButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
    },
    titleButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.tints.accent,
    },
    titleButtonContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleButtonLeft: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    titleButtonRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleButtonLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginBottom: 2,
    },
    titleButtonIndicator: {
      backgroundColor: colors.success,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    titleButtonIndicatorText: {
      color: '#ffffff',
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('semibold'),
    },
    descriptionSection: {
      marginBottom: 3,
      width: '100%',
    },
    descriptionInput: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
      minHeight: 70,
      textAlignVertical: 'top',
    },
    descriptionButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
      marginBottom: 0,
    },
    descriptionButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.tints.accent,
    },
    descriptionButtonContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    descriptionButtonLeft: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    descriptionButtonRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    descriptionButtonLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
      marginBottom: 2,
    },
    descriptionButtonIndicator: {
      backgroundColor: colors.success,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    descriptionButtonIndicatorText: {
      color: '#ffffff',
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('semibold'),
    },
    label: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      paddingLeft: 2,
      marginBottom: 0,
      lineHeight: 20,
    },
    sublabel: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      paddingLeft: 2,
      marginTop: 6,
      marginBottom: 0,
    },
    filterSection: {
      marginBottom: 10,
      marginTop: 5,
      width: '100%',
      position: 'relative',
      zIndex: 1000,
    },
    filterItem: {
      marginBottom: 12,
      position: 'relative',
    },
    filterButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 2,
    },
    filterButtonActive: {
      borderColor: colors.accent,
      backgroundColor: colors.tints.accent,
    },
    filterButtonContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    filterButtonLeft: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    filterButtonRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterButtonLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      marginBottom: 2,
    },
    filterButtonIndicator: {
      backgroundColor: colors.success,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },
    filterButtonIndicatorText: {
      color: '#ffffff',
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('semibold'),
    },
    activeFilters: {
      marginTop: 8,
      marginBottom: 0,
      padding: 8,
      backgroundColor: colors.background,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    activeFiltersText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    clearFiltersButton: {
      position: 'absolute',
      right: 8,
      top: 4,
      bottom: 4,
      padding: 4,
      borderRadius: 4,
      backgroundColor: colors.background,
    },

    searchSection: {
      marginBottom: 8,
      marginTop: 0,
    },
    searchButton: {
      backgroundColor: colors.textMuted,
      borderRadius: 8,
      padding: 10,
      marginTop: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: '#fff',
      marginLeft: 8,
    },
    searchAddedSection: {
      marginBottom: 0,
      marginTop: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionLabel: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
      paddingLeft: 2,
    },
    clearSearchButton: {
      backgroundColor: colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearSearchButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
    },
    searchAddedGameItem: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.tints.accent,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    searchAddedIndicator: {
      backgroundColor: colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    searchAddedIndicatorText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption2,
      color: '#ffffff',
    },
    removeSearchGameButton: {
      width: 20,
      height: 20,
      marginLeft: 8,
      marginRight: 12,
      borderRadius: 4,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },

    clearButton: {
      padding: 2,
    },
    dropdown: {
      backgroundColor: colors.card,
      borderRadius: 8,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      maxHeight: 200,
    },
    dropdownScroll: {
      maxHeight: 200,
    },
    dropdownItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemSelected: {
      backgroundColor: colors.tints.accent,
    },
    dropdownItemText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.text,
    },
    dropdownItemTextSelected: {
      color: colors.accent,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.callout,
    },
    gamesSection: {
      marginTop: 4,
      width: '100%',
      marginBottom: 0,
      paddingBottom: 0,
    },
    gamesListSection: {
      width: '100%',
      marginBottom: 0,
      paddingBottom: 0,
    },
    gamesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
      minHeight: 32,
    },
    gamesHeaderLeft: {
      flex: 1,
    },
    gamesHeaderRight: {
      flexDirection: 'row',
    },
    selectAllButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
    },
    selectAllButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption2,
      color: '#ffffff',
    },
    clearAllButton: {
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    clearAllButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
    },
    gameItem: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    gameThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 6,
      backgroundColor: colors.background,
      marginRight: 8,
    },
    gameItemSelected: {
      backgroundColor: colors.tints.accent,
      borderColor: colors.accent,
    },
    gameItemDisabled: {
      opacity: 0.7,
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    gameThumbnailDisabled: {
      opacity: 0.7,
      backgroundColor: colors.background,
    },
    gameInfo: {
      flex: 1,
      marginRight: 8,
    },
    gameName: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      marginBottom: 4,
    },
    gameNameDisabled: {
      color: colors.textMuted,
    },
    playerCount: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
    },
    playerCountDisabled: {
      color: colors.textMuted,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkboxDisabled: {
      backgroundColor: colors.border,
      borderColor: colors.border,
    },
    noGamesText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 20,
      fontStyle: 'italic',
    },
    errorText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.error,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      padding: 12,
      paddingRight: 14,
      margin: 12,
      borderRadius: 8,
    },
    createButtonDisabled: {
      opacity: 0.7,
    },
    createButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.caption1,
      color: '#ffffff',
    },
    absoluteBackButton: {
      position: 'absolute',
      top: 16,
      left: 16,
      zIndex: 100,
      backgroundColor: colors.tints.neutral,
      borderRadius: 12,
      padding: 4,
      elevation: 2,
      //borderWidth: 1,
      //borderColor: colors.primary,
    },
    absoluteCloseButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 100,
      //backgroundColor: colors.tints.neutral,
      //borderRadius: 12,
      padding: 4,
      elevation: 2,
      //borderWidth: 1,
      //borderColor: colors.error,
    },
    footer: {
      paddingTop: 14,
      paddingBottom: 0,
      paddingLeft: 12,
      paddingRight: 12,
      minHeight: 28,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.text,
    },
    optionTextSelected: {
      color: colors.accent,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
    },
    alreadyInPollText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
      marginTop: 4,
    },
    infoTextEmphasis: {
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.text,
    },
    modalContainer: {
      maxWidth: 800,
      maxHeight: '85%',
      width: '100%',
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    dialogResponsive: {
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '100%',
      maxHeight: '100%',
    },
  });
};

