import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, TouchableOpacity, ScrollView, TextInput, Alert, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { supabase } from '@/services/supabase';
import Toast from 'react-native-toast-message';
import { decode } from 'html-entities';

import { CreatePollModal } from './CreatePollModal';
import { CreatePollDetails } from './CreatePollDetails';
import { sortGamesByTitle } from '@/utils/sortingUtils';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';

import { Game } from '@/types/game';

interface EditPollModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pollId: string;
  pollTitle: string;
  pollDescription?: string;
}

export const EditPollModal: React.FC<EditPollModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
  pollId,
  pollTitle,
  pollDescription,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [originalPollGames, setOriginalPollGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingVotes, setHasExistingVotes] = useState(false);
  const [voterCount, setVoterCount] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'save' | 'addGames'>('save');
  const [showCreatePollModal, setShowCreatePollModal] = useState(false);
  const [dynamicPollTitle, setDynamicPollTitle] = useState(pollTitle);
  const [isTitleManuallyChanged, setIsTitleManuallyChanged] = useState(false);
  const [dynamicPollDescription, setDynamicPollDescription] = useState(pollDescription || '');
  const [isDetailsModalVisible, setIsDetailsModalVisible] = useState(false);



  useEffect(() => {
    if (isVisible) {
      loadGames();
      checkExistingVotes();
      // Reset the title change flag when opening a new poll
      setIsTitleManuallyChanged(false);
      setDynamicPollTitle(pollTitle);
      setDynamicPollDescription(pollDescription || '');
      // Reset warning dismissed state when opening modal
      setWarningDismissed(false);
    }
  }, [isVisible, pollId, pollTitle, pollDescription]);

  // Function to generate updated poll title based on game count
  const generateUpdatedTitle = (gameCount: number) => {
    if (gameCount === 0) {
      return 'No games in poll';
    } else if (gameCount === 1) {
      return 'Vote on 1 game';
    } else {
      return `Vote on ${gameCount} games`;
    }
  };

  // Check if the current title is in the default format
  const isDefaultTitle = (title: string) => {
    return title === 'No games in poll' ||
      title === 'Vote on 1 game' ||
      title.match(/^Vote on \d+ games$/);
  };

  // Update title when selected games change, but only if it's a default title
  useEffect(() => {
    if (isDefaultTitle(dynamicPollTitle)) {
      const newTitle = generateUpdatedTitle(selectedGames.length);
      setDynamicPollTitle(newTitle);
    }
    // Don't auto-update if user has a custom title!
  }, [selectedGames.length]);

  // Update dynamicPollTitle when pollTitle prop changes
  useEffect(() => {
    setDynamicPollTitle(pollTitle);
  }, [pollTitle]);

  const checkExistingVotes = async () => {
    try {
      const { data: votes, error } = await supabase
        .from('votes')
        .select('user_id, voter_name')
        .eq('poll_id', pollId);

      if (!error && votes) {
        // Count unique voters
        const uniqueVoters = new Set(
          votes.map((vote: any) => vote.user_id || vote.voter_name)
        );
        const voterCount = uniqueVoters.size;

        setHasExistingVotes(voterCount > 0);
        setVoterCount(voterCount);
      }
    } catch (err) {
      console.error('Error checking existing votes:', err);
    }
  };

  const loadGames = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load current poll games from poll_games table
      const { data: pollGames, error: pollGamesError } = await supabase
        .from('poll_games')
        .select('game_id')
        .eq('poll_id', pollId);

      if (pollGamesError) throw pollGamesError;

      if (pollGames && pollGames.length > 0) {
        const gameIds = pollGames.map(pg => pg.game_id);

        // Get the actual game details from games table (same as usePollData.ts)
        const { data: gamesData, error: gameDetailsError } = await supabase
          .from('games')
          .select('*')
          .in('id', gameIds);

        if (gameDetailsError) throw gameDetailsError;

        if (gamesData && gamesData.length > 0) {
          // Map games data to the expected format (same as usePollData.ts)
          const currentGames = gamesData.map(game => ({
            id: game.id,
            name: game.name,
            thumbnail: game.thumbnail || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg',
            image: game.image_url || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg',
            min_players: game.min_players,
            max_players: game.max_players,
            min_exp_players: game.min_players,
            max_exp_players: game.max_players,
            playing_time: game.playing_time,
            yearPublished: game.year_published,
            description: game.description,
            minAge: game.min_age,
            is_cooperative: game.is_cooperative,
            is_teambased: game.is_teambased,
            complexity: game.complexity,
            minPlaytime: game.minplaytime,
            maxPlaytime: game.maxplaytime,
            complexity_tier: game.complexity_tier,
            complexity_desc: game.complexity_desc,
            bayesaverage: game.bayesaverage,
            expansions: [],
          }));

          setOriginalPollGames(currentGames);
          setSelectedGames(currentGames);
        } else {
          setOriginalPollGames([]);
          setSelectedGames([]);
        }
      } else {
        setOriginalPollGames([]);
        setSelectedGames([]);
      }

      // Load user's collection games for the "Add More Games" functionality
      const { data: collectionData, error: collectionError } = await supabase
        .from('collections_games')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (collectionError) throw collectionError;

      const collectionGames = collectionData.map(game => ({
        id: game.bgg_game_id,
        name: game.name,
        thumbnail: game.thumbnail,
        min_players: game.min_players,
        max_players: game.max_players,
        min_exp_players: game.min_players,
        max_exp_players: game.max_players,
        playing_time: game.playing_time,
        yearPublished: game.year_published,
        description: game.description,
        image: game.image_url,
        minAge: game.min_age,
        is_cooperative: game.is_cooperative,
        is_teambased: game.is_teambased,
        complexity: game.complexity,
        minPlaytime: game.minplaytime,
        maxPlaytime: game.maxplaytime,
        complexity_tier: game.complexity_tier,
        complexity_desc: game.complexity_desc,
        bayesaverage: game.bayesaverage,
        expansions: [],
      }));

      // Sort games alphabetically by title, ignoring articles
      const sortedGames = sortGamesByTitle(collectionGames);
      setAvailableGames(sortedGames);
    } catch (err) {
      console.error('Error loading games:', err);
      setError('Failed to load games');
    }
  };



  const handleSaveChanges = async () => {
    if (selectedGames.length === 0) {
      setError('Please select at least one game.');
      return;
    }

    // Show warning if there are existing votes
    if (hasExistingVotes) {
      setConfirmationAction('save');
      setShowConfirmation(true);
    } else {
      performSave();
    }
  };

  const performSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate pollId
      if (!pollId) {
        throw new Error('Invalid poll ID');
      }

      // Get current poll games
      const { data: currentPollGames, error: currentError } = await supabase
        .from('poll_games')
        .select('game_id')
        .eq('poll_id', pollId);

      if (currentError) {
        throw currentError;
      }

      const currentGameIds = currentPollGames?.map(pg => pg.game_id) || [];
      const newGameIds = selectedGames.map(game => game.id);

      // Find games to remove and add
      const gamesToRemove = currentGameIds.filter(id => !newGameIds.includes(id));
      const gamesToAdd = newGameIds.filter(id => !currentGameIds.includes(id));

      // Try selective removal first (preserves existing games)
      if (gamesToRemove.length > 0) {
        const { data: deleteResult, error: removeError } = await supabase
          .from('poll_games')
          .delete()
          .eq('poll_id', pollId)
          .in('game_id', gamesToRemove)
          .select();

        if (removeError) {
          throw new Error('Unable to remove games from poll. This might be due to database permissions. Please contact support.');
        }
      }

      // Update the poll title and description if they have changed
      const updates: any = {};
      if (dynamicPollTitle !== pollTitle) {
        updates.title = dynamicPollTitle;
      }
      if (dynamicPollDescription !== (pollDescription || '')) {
        updates.description = dynamicPollDescription.trim() || null;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('polls')
          .update(updates)
          .eq('id', pollId);

        if (updateError) {
          throw updateError;
        }
      }

      // Add new games (existing games are preserved)
      if (gamesToAdd.length > 0) {
        const newPollGames = gamesToAdd.map(gameId => ({
          poll_id: pollId,
          game_id: gameId,
        }));

        const { error: addError } = await supabase
          .from('poll_games')
          .insert(newPollGames);

        if (addError) {
          throw addError;
        }
      }

      announceForAccessibility('Poll changes saved successfully');
      Toast.show({
        type: 'success',
        text1: 'Poll updated successfully!',
        visibilityTime: 3000,
        autoHide: true,
        topOffset: 50
      });

      onSuccess(); // This will handle closing the modal and refreshing the polls
    } catch (err) {
      console.error('Error updating poll:', err);
      setError(err instanceof Error ? err.message : 'Failed to update poll');
    } finally {
      setLoading(false);
    }
  };

  const toggleGameSelection = (game: Game) => {
    setSelectedGames(current => {
      const isSelected = current.some(g => g.id === game.id);
      announceForAccessibility(`${decode(game.name)} ${isSelected ? 'deselected' : 'selected'}`);
      if (isSelected) {
        return current.filter(g => g.id !== game.id);
      } else {
        return [...current, game];
      }
    });
  };

  const styles = useMemo(() => getStyles(colors, typography, insets, screenHeight), [colors, typography, insets, screenHeight]);

  if (!isVisible) return null;

  return (
    <>
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Edit Poll</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityLabel="Close"
                accessibilityHint="Closes the edit poll modal"
                hitSlop={touchTargets.small}
              >
                <SFSymbolIcon name="x" />
              </TouchableOpacity>
            </View>

            {/* Warning about existing votes */}
            {hasExistingVotes && !warningDismissed && (
              <View style={styles.warningHeader} accessibilityRole="alert">
                <SFSymbolIcon name="alert-triangle" />
                <Text style={styles.warningHeaderText}>
                  This poll already has {voterCount} voter{voterCount !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={styles.warningDismissButton}
                  onPress={() => setWarningDismissed(true)}
                  accessibilityLabel="Dismiss warning"
                  accessibilityHint="Dismisses the existing votes warning"
                  hitSlop={touchTargets.small}
                >
                  <SFSymbolIcon name="x" />
                </TouchableOpacity>
              </View>
            )}

            {/* Custom confirmation dialog */}
            {showConfirmation && (
              <View style={styles.confirmationOverlay}>
                <View style={styles.confirmationDialog}>
                  <Text style={styles.confirmationTitle}>Warning: Existing Votes</Text>
                  <Text style={styles.confirmationMessage}>
                    {confirmationAction === 'save'
                      ? 'This poll already has votes. Are you sure you want to continue?'
                      : 'This poll already has votes. Continue to add games?'
                    }
                  </Text>
                  <View style={styles.confirmationButtons}>
                    <TouchableOpacity
                      style={styles.confirmationButtonCancel}
                      onPress={() => {
                        setShowConfirmation(false);
                      }}
                      accessibilityLabel="Cancel"
                      accessibilityHint="Cancels the current action and closes the confirmation dialog"
                      hitSlop={touchTargets.small}
                    >
                      <Text style={styles.confirmationButtonTextCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmationButtonContinue}
                      onPress={() => {
                        setShowConfirmation(false);
                        if (confirmationAction === 'save') {
                          performSave();
                        } else {
                          announceForAccessibility('Opening add games modal');
                          setShowCreatePollModal(true);
                        }
                      }}
                      accessibilityLabel={confirmationAction === 'save' ? 'Continue' : 'Add Games'}
                      accessibilityHint={confirmationAction === 'save' ? 'Continues with saving poll changes' : 'Opens the add games modal'}
                      hitSlop={touchTargets.small}
                    >
                      <Text style={styles.confirmationButtonTextContinue}>
                        {confirmationAction === 'save' ? 'Continue' : 'Add Games'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <ScrollView
              style={styles.content}
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            >
              <View style={styles.descriptionSection}>
                <TouchableOpacity
                  style={[styles.descriptionButton, (dynamicPollDescription || isTitleManuallyChanged) && styles.descriptionButtonActive]}
                  onPress={() => {
                    announceForAccessibility('Opening poll details editor');
                    setIsDetailsModalVisible(true);
                  }}
                  accessibilityLabel="Edit Title & Description"
                  accessibilityHint="Opens the poll title and description editor"
                  hitSlop={touchTargets.small}
                >
                  <View style={styles.descriptionButtonContent}>
                    <View style={styles.descriptionButtonLeft}>
                      <Text style={styles.descriptionButtonLabel}>Edit Title & Description</Text>
                    </View>
                    <View style={styles.descriptionButtonRight}>
                      <View style={[styles.descriptionButtonIndicator, { opacity: (dynamicPollDescription || isTitleManuallyChanged) ? 1 : 0 }]}>
                        <Text style={styles.descriptionButtonIndicatorText}>✓</Text>
                      </View>
                      <SFSymbolIcon name="square-pen" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {originalPollGames.length > 0 && (
                <View style={styles.currentGamesSection}>
                  <Text style={styles.sublabel}>
                    Uncheck to remove from poll
                  </Text>

                  {originalPollGames.map(game => {
                    const decodedName = decode(game.name);
                    const isSelected = selectedGames.some(g => g.id === game.id);
                    return (
                      <TouchableOpacity
                        key={game.id}
                        style={[
                          styles.gameItem,
                          isSelected && styles.gameItemSelected
                        ]}
                        onPress={() => toggleGameSelection(game)}
                        accessibilityLabel={`${decodedName}, ${game.min_players}-${game.max_players} players`}
                        accessibilityHint={isSelected ? "Tap to remove from poll" : "Tap to keep in poll"}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        hitSlop={touchTargets.small}
                      >
                        <Image
                          source={{ uri: game.thumbnail || game.image || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg' }}
                          style={styles.gameThumbnail}
                          resizeMode="cover"
                          accessibilityLabel={`${decodedName} thumbnail`}
                        />
                        <View style={styles.gameInfo}>
                          <Text style={styles.gameName}>{decodedName}</Text>
                          <Text style={styles.playerCount}>
                            {game.min_players}-{game.max_players} players • {game.playing_time ? `${game.playing_time} min` : game.minPlaytime && game.maxPlaytime ? (game.minPlaytime === game.minPlaytime ? `${game.minPlaytime} min` : `${game.minPlaytime}-${game.maxPlaytime} min`) : game.minPlaytime || game.maxPlaytime ? `${game.minPlaytime || game.maxPlaytime} min` : 'Unknown time'}
                          </Text>
                        </View>
                        <View style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected
                        ]}>
                          {isSelected && (
                            <SFSymbolIcon name="check" color="#ffffff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={styles.addGamesButton}
                onPress={() => {
                  if (hasExistingVotes) {
                    setConfirmationAction('addGames');
                    setShowConfirmation(true);
                  } else {
                    announceForAccessibility('Opening add games modal');
                    setShowCreatePollModal(true);
                  }
                }}
                accessibilityLabel={originalPollGames.length === 0 ? 'Add Games to Poll' : 'Add More Games'}
                accessibilityHint="Opens the add games modal to select additional games"
                hitSlop={touchTargets.small}
              >
                <SFSymbolIcon name="plus" />
                <Text style={styles.addGamesButtonText}>
                  {originalPollGames.length === 0 ? 'Add Games to Poll' : 'Add More Games'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <TouchableOpacity
                style={[styles.saveButton, loading || selectedGames.length === 0 ? styles.saveButtonDisabled : undefined]}
                onPress={handleSaveChanges}
                disabled={loading || selectedGames.length === 0}
                accessibilityLabel={loading ? 'Saving...' : 'Save Changes'}
                accessibilityHint="Saves the poll changes and closes the editor"
                hitSlop={touchTargets.small}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CreatePollModal for adding more games */}
      <CreatePollModal
        isVisible={showCreatePollModal}
        onClose={() => setShowCreatePollModal(false)}
        onSuccess={(pollType, addedGames) => {
          setShowCreatePollModal(false);
          if (pollType === 'add-games' && addedGames) {
            // Add the new games to the current selection
            setSelectedGames(current => [...current, ...addedGames]);
            // Also add them to originalPollGames so they show up in the list
            setOriginalPollGames(current => [...current, ...addedGames]);
          } else {
            // Refresh the games list for other cases
            loadGames();
          }
        }}
        preselectedGames={originalPollGames}
        isAddingToExistingPoll={true}
      />

      {/* CreatePollDetails Modal for editing title and description */}
      <CreatePollDetails
        isVisible={isDetailsModalVisible}
        onClose={() => setIsDetailsModalVisible(false)}
        onSave={(title, description) => {
          setDynamicPollTitle(title);
          setDynamicPollDescription(description);
          setIsDetailsModalVisible(false);
        }}
        currentTitle={dynamicPollTitle}
        currentDescription={dynamicPollDescription}
      />
    </>
  );
};

const getStyles = (colors: any, typography: any, insets: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(500, Math.min(650, screenHeight * 0.75));

  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      paddingTop: Math.max(16, insets.top),
      paddingBottom: Math.max(16, insets.bottom),
      paddingHorizontal: 16,
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: 12,
      width: '90%',
      maxWidth: 600,
      maxHeight: '90%',
      minHeight: responsiveMinHeight,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
      paddingTop: 0,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: typography.fontSize.headline,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.text,
      marginLeft: 12,
    },
    closeButton: {
      padding: 4,
    },
    warningHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tints.warning,
      borderTopWidth: 1,
      borderTopColor: colors.warning,
      borderBottomWidth: 1,
      borderBottomColor: colors.warning,
      padding: 16,
      margin: 0,
    },
    warningHeaderText: {
      flex: 1,
      fontSize: typography.fontSize.callout,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.textMuted,
      marginLeft: 12,
    },
    warningDismissButton: {
      padding: 4,
      borderRadius: 4,
      backgroundColor: colors.tints.warning,
    },
    content: {
      flex: 1,
      padding: 20,
      paddingTop: 10,
    },
    descriptionSection: {
      marginBottom: 10,
      width: '100%',
      paddingTop: 4,
    },
    descriptionButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      marginTop: 8,
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
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
    },
    descriptionButtonIndicator: {
      backgroundColor: colors.success,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      marginRight: 6,
    },
    descriptionButtonIndicatorText: {
      color: '#ffffff',
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('semibold'),
    },
    currentGamesSection: {
      marginBottom: 0,
      marginTop: 0,
    },
    sublabel: {
      fontSize: typography.fontSize.subheadline,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.textMuted,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: typography.fontSize.subheadline,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.text,
      marginBottom: 12,
    },
    addGamesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      borderRadius: 8,
      padding: 16,
      marginTop: 8,
    },
    addGamesButtonText: {
      fontSize: typography.fontSize.subheadline,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.primary,
      marginLeft: 8,
    },
    gameItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: colors.card,
    },
    gameThumbnail: {
      width: 60,
      height: 60,
      borderRadius: 8,
      backgroundColor: colors.background,
      marginRight: 12,
    },
    gameItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.tints.primary,
    },
    gameInfo: {
      flex: 1,
    },
    gameName: {
      fontSize: typography.fontSize.callout,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.text,
      marginBottom: 2,
    },
    playerCount: {
      fontSize: typography.fontSize.caption1,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.textMuted,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    errorText: {
      fontSize: typography.fontSize.callout,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.error,
      marginBottom: 12,
      textAlign: 'center',
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    saveButtonText: {
      fontSize: typography.fontSize.subheadline,
      fontFamily: typography.getFontFamily('semibold'),
      color: '#ffffff',
    },
    confirmationOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.tints.neutral,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    },
    confirmationDialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 24,
      margin: 20,
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    confirmationTitle: {
      fontSize: typography.fontSize.title3,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.text,
      marginBottom: 12,
    },
    confirmationMessage: {
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.textMuted,
      marginBottom: 20,
      lineHeight: 20,
    },
    confirmationButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    confirmationButtonCancel: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: colors.background,
    },
    confirmationButtonTextCancel: {
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      color: colors.textMuted,
    },
    confirmationButtonContinue: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      backgroundColor: colors.primary,
      marginLeft: 12,
    },
    confirmationButtonTextContinue: {
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      color: '#ffffff',
    },
  });
};
