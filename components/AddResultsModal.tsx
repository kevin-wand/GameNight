
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { supabase } from '@/services/supabase';
import { ThumbnailModal } from './ThumbnailModal';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useBodyScrollLock } from '@/utils/scrollLock';
import { useDeviceType } from '@/hooks/useDeviceType';

interface AddResultsModalProps {
  isVisible: boolean;
  onClose: () => void;
  onBack: () => void;
  imageData: {
    uri: string;
    name: string;
    type: string;
  } | null;
  analysisResults: {
    result: string;
    boardGames: any[];
  } | null;
  onGamesAdded?: () => void; // Add this callback prop
}

export const AddResultsModal: React.FC<AddResultsModalProps> = ({
  isVisible,
  onClose,
  onBack,
  imageData,
  analysisResults,
  onGamesAdded,
}) => {
  const { colors, typography, touchTargets } = useTheme();
  const { announceForAccessibility } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { screenHeight } = useDeviceType();

  // Lock body scroll on web when modal is visible
  useBodyScrollLock(isVisible);

  const [selectedGames, setSelectedGames] = useState<Set<number>>(new Set());
  const [databaseResults, setDatabaseResults] = useState<any[] | null>(null);
  const [loadingDatabase, setLoadingDatabase] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showNoSelectionWarning, setShowNoSelectionWarning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const styles = useMemo(() => getStyles(colors, typography, insets, screenHeight), [colors, typography, insets, screenHeight]);

  // Parse board games from analysis results
  const parsedBoardGames = analysisResults?.boardGames || [];

  // Only include games that have valid database matches
  const validDetectedGames = useMemo(() => {
    if (!databaseResults || !parsedBoardGames) return [] as any[];
    return parsedBoardGames.filter((game: any) => {
      const comparison = databaseResults.find(
        (comp: any) => comp.detected.bgg_id === game.bgg_id
      );
      return !!(comparison && comparison.inDatabase && comparison.gameData);
    });
  }, [parsedBoardGames, databaseResults]);

  // Initialize selectedGames with games not in collection (from valid results only)
  useEffect(() => {
    if (validDetectedGames && validDetectedGames.length > 0 && databaseResults) {
      const gamesNotInCollection = validDetectedGames
        .filter((game: any) => {
          const comparison = databaseResults.find(
            (comp: any) => comp.detected.bgg_id === game.bgg_id
          );
          return !comparison?.inCollection;
        })
        .map((game: any) => game.bgg_id);

      setSelectedGames(new Set(gamesNotInCollection));
    }
  }, [validDetectedGames, databaseResults]);

  const handleGameSelection = (bggId: number) => {
    const newSelected = new Set(selectedGames);

    // Check if this game is in the user's collection
    const comparison = databaseResults?.find(
      (comp: any) => comp.detected.bgg_id === bggId
    );
    const isInCollection = comparison?.inCollection || false;

    // Don't allow selection of games already in collection
    if (isInCollection) {
      return;
    }

    if (newSelected.has(bggId)) {
      newSelected.delete(bggId);
      announceForAccessibility('Game deselected');
    } else {
      newSelected.add(bggId);
      announceForAccessibility('Game selected');
    }
    setSelectedGames(newSelected);
  };

  const handleThumbnailPress = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageModalVisible(true);
    announceForAccessibility('Opening game thumbnail in full size');
  };




  const handleAddSelectedToCollection = async () => {
    if (selectedGames.size === 0) {
      setShowNoSelectionWarning(true);
      // Hide warning after 3 seconds
      setTimeout(() => setShowNoSelectionWarning(false), 3000);
      return;
    }

    try {
      setAddingToCollection(true);
      setAddError(null);

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAddError('User not authenticated');
        return;
      }

      // Get the selected games data from database results (only games that are in the database)
      const selectedGameData = databaseResults?.filter((result: any) =>
        selectedGames.has(result.detected.bgg_id) && result.inDatabase
      ) || [];

      if (selectedGameData.length === 0) {
        setAddError('No valid games selected for collection. Only games found in the database can be added.');
        return;
      }

      // Check which games are already in the collection
      const bggIds = selectedGameData.map((result: any) => result.detected.bgg_id);
      const { data: existingGames } = await supabase
        .from('collections')
        .select('bgg_game_id')
        .eq('user_id', user.id)
        .in('bgg_game_id', bggIds);

      const existingBggIds = new Set(existingGames?.map(g => g.bgg_game_id) || []);
      const newGames = selectedGameData.filter((result: any) => !existingBggIds.has(result.detected.bgg_id));

      const duplicateCount = selectedGameData.length - newGames.length;

      if (newGames.length === 0) {
        setAddError(`All ${selectedGameData.length} selected game${selectedGameData.length !== 1 ? 's' : ''} were already found in your collection`);
        return;
      }

      // Create game data from database results (no need to fetch from BGG API)
      const gameData = newGames.map((result: any) => {
        const detectedGame = result.detected;
        const databaseGame = result.gameData;

        return {
          user_id: user.id,
          bgg_game_id: databaseGame?.id,
          name: databaseGame?.name || detectedGame.title,
          thumbnail: databaseGame?.thumbnail || 'https://cf.geekdo-images.com/zxVVmggfpHJpmnJY9j-k1w__imagepagezoom/img/RO6wGyH4m4xOJWkgv6OVlf6GbrA=/fit-in/1200x900/filters:no_upscale():strip_icc()/pic1657689.jpg',
          min_players: databaseGame?.min_players || 1,
          max_players: databaseGame?.max_players || 4,
          playing_time: databaseGame?.playing_time || 60,
          year_published: databaseGame?.year_published || null,
          description: databaseGame?.description || '',
        };
      });

      // Insert the games into the collection
      const { error: insertError } = await supabase
        .from('collections')
        .upsert(gameData, { onConflict: 'user_id,bgg_game_id' });

      if (insertError) throw insertError;

      // Clear selections and show success
      setSelectedGames(new Set());
      setAddError(null);

      // Create success message
      let message = `Successfully added ${newGames.length} game${(newGames.length) !== 1 ? 's' : ''} to your collection`;
      if (duplicateCount > 0) {
        message += ` (${duplicateCount} game${duplicateCount !== 1 ? 's' : ''} were already in your collection)`;
      }
      setSuccessMessage(message);
      setShowSuccessView(true);

      // Call the callback to refresh the collection
      if (onGamesAdded) {
        onGamesAdded();
      }
    } catch (err) {
      console.error('Error adding games to collection:', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add games to collection');
    } finally {
      setAddingToCollection(false);
    }
  };

  // Calculate similarity between two strings
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1.0;
    if (str1.length === 0) return 0.0;
    if (str2.length === 0) return 0.0;

    // Check for exact substring matches
    if (str1.includes(str2) || str2.includes(str1)) {
      return 0.8;
    }

    // Regex-based matching for common patterns
    const regexMatches = checkRegexPatterns(str1, str2);
    if (regexMatches > 0) {
      return regexMatches;
    }

    // Check for word matches
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));

    if (commonWords.length > 0) {
      const wordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
      return wordSimilarity * 0.7; // Weight word matches
    }

    // Simple character-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Check for common regex patterns in game names
  const checkRegexPatterns = (str1: string, str2: string): number => {
    const patterns = [
      // Remove common suffixes/prefixes for comparison
      { pattern: /\s*(deluxe|edition|version|game|board game|card game)\s*$/i, weight: 0.9 },
      // Handle numbered versions
      { pattern: /\s*(2|3|4|5|6|7|8|9|10|II|III|IV|V|VI|VII|VIII|IX|X)\s*$/i, weight: 0.85 },
      // Handle expansions
      { pattern: /\s*(expansion|expansion pack|add-on)\s*$/i, weight: 0.8 },
      // Handle special characters and punctuation
      { pattern: /[^\w\s]/g, weight: 0.95 },
      // Handle "The" prefix
      { pattern: /^the\s+/i, weight: 0.9 },
      // Handle year suffixes
      { pattern: /\s*\d{4}\s*$/i, weight: 0.85 }
    ];

    for (const { pattern, weight } of patterns) {
      const clean1 = str1.replace(pattern, '').trim();
      const clean2 = str2.replace(pattern, '').trim();

      if (clean1 === clean2 && clean1.length > 0) {
        return weight;
      }

      // Check if one cleaned string contains the other
      if (clean1.includes(clean2) || clean2.includes(clean1)) {
        return weight * 0.8;
      }
    }

    return 0;
  };

  // Levenshtein distance calculation
  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  // Query database for detected games
  useEffect(() => {
    const queryDatabase = async () => {
      if (!parsedBoardGames || parsedBoardGames.length === 0) {
        setDatabaseResults(null);
        setLoadingDatabase(false);
        return;
      }

      // Prevent multiple queries for the same data
      if (databaseResults !== null || hasQueried) return;

      setHasQueried(true);
      setLoadingDatabase(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingDatabase(false);
          return;
        }

        const searchPromises = parsedBoardGames.map(async (detectedGame: any) => {
          const detectedTitle = detectedGame.title;

          // Use Supabase text search for better performance
          const { data: searchResults, error: searchError } = await supabase
            .from('games')
            .select('id, name, image_url, year_published, min_players, max_players, playing_time, complexity, description, rank')
            .textSearch('name', detectedTitle, {
              type: 'websearch',
              config: 'english'
            })
            .order('rank', { ascending: true })
            .limit(10); // Limit results for performance

          if (searchError) {
            console.error(`Search error for "${detectedTitle}":`, searchError);
            return null;
          }

          // Apply fuzzy matching to search results
          const fuzzyMatches = searchResults?.map((game: any) => {
            const gameName = game.name.toLowerCase();
            const similarity = calculateSimilarity(detectedTitle.toLowerCase(), gameName);

            return {
              game,
              similarity,
              rank: game.rank || 999999
            };
          }).filter((match: any) => match.similarity > 0.3)
            .sort((a: any, b: any) => {
              // Primary sort: similarity (highest first)
              if (a.similarity !== b.similarity) {
                return b.similarity - a.similarity;
              }
              // Secondary sort: rank (lowest rank number = highest ranked game)
              return a.rank - b.rank;
            });

          const bestMatch = fuzzyMatches?.[0];

          // Check if the game is already in the user's collection
          let inCollection = false;
          if (bestMatch?.game?.id) {
            const { data: collectionCheck } = await supabase
              .from('collections')
              .select('id')
              .eq('user_id', user.id)
              .eq('bgg_game_id', bestMatch.game.id)
              .single();

            inCollection = !!collectionCheck;
          }

          return {
            detected: detectedGame,
            fuzzyMatches: fuzzyMatches || [],
            bestMatch: bestMatch || null,
            inDatabase: !!bestMatch,
            gameData: bestMatch?.game || null,
            inCollection: inCollection,
          };
        });

        // Wait for all searches to complete
        const results = await Promise.all(searchPromises);
        const validResults = results.filter(result => result !== null);

        if (validResults.length === 0) {
          setDatabaseResults(null);
        } else {
          setDatabaseResults(validResults);
        }
      } catch (error) {
        console.error('Database query failed:', error);
        setDatabaseResults(null);
      } finally {
        setLoadingDatabase(false);
      }
    };

    queryDatabase();
  }, [parsedBoardGames]);



  const content = (
    <View style={styles.dialog}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            onBack();
            announceForAccessibility('Returning to image analysis');
          }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          accessibilityHint="Returns to the image analysis step"
          hitSlop={touchTargets.sizeTwenty}
        >
          <SFSymbolIcon name="arrow-left" />
        </TouchableOpacity>
        <Text style={styles.title}>Analysis Results</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            onClose();
            announceForAccessibility('Analysis results modal closed');
          }}
          accessibilityLabel="Close modal"
          accessibilityRole="button"
          accessibilityHint="Closes the analysis results modal"
          hitSlop={touchTargets.sizeTwenty}
        >
          <SFSymbolIcon name="x" />
        </TouchableOpacity>
      </View>

      {showSuccessView ? (
        // Success View
        <View style={styles.successView}>
          <View style={styles.successIconContainer}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Success!</Text>
          <Text style={styles.successMessage}>{successMessage}</Text>
          <TouchableOpacity
            style={styles.okButton}
            onPress={() => {
              setShowSuccessView(false);
              setSuccessMessage(null);
              onClose();
              announceForAccessibility('Games successfully added to collection');
            }}
            accessibilityLabel="OK"
            accessibilityRole="button"
            accessibilityHint="Confirms successful addition and closes modal"
            hitSlop={touchTargets.standard}
          >
            <Text style={styles.okButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Main Content View
        <View style={styles.contentContainer}>
          {loadingDatabase && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.text} />
              <Text style={styles.loadingText}>Searching database for matches...</Text>
            </View>
          )}

          {!loadingDatabase && validDetectedGames && validDetectedGames.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Detected Games ({validDetectedGames.length} found)</Text>

              <ScrollView
                style={styles.gamesScrollView}
                contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.gamesContainer}>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    <Text style={styles.headerText}>Select to Add Game(s)</Text>
                    {/*<Text style={styles.headerText}>Thumbnail</Text>*/}
                    {/*<Text style={styles.headerText}>Game</Text>*/}
                  </View>

                  {/* Games List */}
                  <View style={styles.gamesList}>
                    {validDetectedGames.map((game: any, index: number) => {
                      const comparison = databaseResults?.find(
                        (comp: any) => comp.detected.bgg_id === game.bgg_id
                      );
                      const isInCollection = comparison?.inCollection || false;
                      // For games not in collection, default to selected unless explicitly deselected
                      // For games in collection, they can't be selected anyway
                      const isSelected = isInCollection ? false : selectedGames.has(game.bgg_id);

                      return (
                        <View
                          key={index}
                          style={[
                            styles.gameItem,
                            isInCollection && styles.gameAlreadyInCollection
                          ]}
                        >
                          {/* Checkbox */}
                          <TouchableOpacity
                            style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                            onPress={() => handleGameSelection(game.bgg_id)}
                            disabled={isInCollection}
                            accessibilityLabel={isSelected ? 'Deselect game' : 'Select game'}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: isSelected }}
                            accessibilityHint={isInCollection ? 'Game already in collection' : 'Toggle game selection'}
                            hitSlop={touchTargets.standard}
                          >
                            {isSelected && <SFSymbolIcon name="check" color="#fff" />}
                          </TouchableOpacity>

                          {/* Thumbnail */}
                          <View style={styles.thumbnailSection}>
                            {comparison && comparison.gameData && comparison.gameData.image_url ? (
                              <TouchableOpacity
                                onPress={() => handleThumbnailPress(comparison.gameData.image_url)}
                                style={styles.thumbnailContainer}
                                accessibilityLabel="View game thumbnail"
                                accessibilityRole="button"
                                accessibilityHint="Opens game thumbnail in full size"
                                hitSlop={touchTargets.standard}
                              >
                                <Image
                                  source={{ uri: comparison.gameData.image_url }}
                                  style={[styles.gameThumbnail, isInCollection && styles.greyedOutImage]}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.noThumbnail}>
                                <Text style={styles.noThumbnailText}>No image</Text>
                              </View>
                            )}
                          </View>

                          {/* Game Info */}
                          <View style={styles.gameInfoSection}>
                            {comparison && comparison.gameData ? (
                              <Text style={[styles.gameTitle, isInCollection && styles.greyedOutText]}>
                                {comparison.gameData.name}
                              </Text>
                            ) : (
                              <Text style={styles.statusText}>Not in database</Text>
                            )}
                            {isInCollection && (
                              <Text style={styles.alreadyInCollectionText}>Already in collection</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </>
          )}

          {parsedBoardGames && parsedBoardGames.length === 0 && (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>No board games detected in the image.</Text>
            </View>
          )}

          {/* Sticky action buttons at bottom */}
          {!loadingDatabase && parsedBoardGames && parsedBoardGames.length > 0 && (
            <View style={styles.stickyActionButtons}>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.addToCollectionButton, addingToCollection && { opacity: 0.7 }]}
                  onPress={() => {
                    handleAddSelectedToCollection();
                    announceForAccessibility('Adding selected games to collection');
                  }}
                  disabled={addingToCollection}
                  accessibilityLabel={`Add ${selectedGames.size} game${selectedGames.size !== 1 ? 's' : ''} to collection`}
                  accessibilityRole="button"
                  accessibilityHint="Adds the selected games to your collection"
                  hitSlop={touchTargets.standard}
                >
                  {addingToCollection ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.addToCollectionButtonText}>
                      Add to Collection
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    onBack();
                    announceForAccessibility('Canceling image upload');
                  }}
                  accessibilityLabel="Cancel upload"
                  accessibilityRole="button"
                  accessibilityHint="Cancels the image upload process"
                  hitSlop={touchTargets.standard}
                >
                  <Text style={styles.cancelButtonText}>Cancel Upload</Text>
                </TouchableOpacity>
              </View>

              {showNoSelectionWarning && (
                <Text style={styles.warningText}>Please select at least one game to add to your collection</Text>
              )}
              {addError && (
                <Text style={styles.errorText}>{addError}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Thumbnail Modal */}
      <ThumbnailModal
        isVisible={imageModalVisible}
        imageUrl={selectedImageUrl}
        onClose={() => setImageModalVisible(false)}
      />
    </View>
  );

  if (Platform.OS === 'web') {
    if (!isVisible) return null;
    return (
      <View style={styles.webOverlay} onTouchEnd={() => {
        if (showSuccessView) {
          setShowSuccessView(false);
          setSuccessMessage(null);
          onClose();
        }
      }}>
        {content}
      </View>
    );
  }

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => {
          if (showSuccessView) {
            setShowSuccessView(false);
            setSuccessMessage(null);
            onClose();
          }
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {content}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyles = (colors: any, typography: any, insets: any, screenHeight: number) => {
  const responsiveMinHeight = Math.max(450, Math.min(600, screenHeight * 0.75));

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
      padding: 20,
    },
    dialog: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      width: '100%',
      maxWidth: 500,
      maxHeight: '90%',
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
    backButton: {
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButton: {
      padding: 4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.headline,
      color: colors.text,
    },
    contentContainer: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
    gamesScrollView: {
      flex: 1,
      marginBottom: 16,
    },
    imageSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    analyzedImage: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginBottom: 8,
    },
    imageName: {
      fontFamily: 'Poppins-Regular',
      fontSize: 12,
      color: '#666666',
    },
    resultsSection: {
      flex: 1,
    },
    sectionTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      marginBottom: 12,
    },
    resultCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
    },
    resultText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      lineHeight: 20,
    },
    boardGamesSection: {
      marginTop: 16,
    },
    gamesContainer: {
      flex: 1,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      flex: 1,
    },
    gamesList: {
      flex: 1,
    },
    gameItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    thumbnailSection: {
      marginRight: 12,
    },
    gameInfoSection: {
      flex: 1,
      justifyContent: 'center',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.text,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    checkboxSelected: {
      backgroundColor: colors.text,
      borderColor: colors.text,
    },
    gameTitle: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.text,
    },
    thumbnailContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    gameThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
    },
    noThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noThumbnailText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
      textAlign: 'center',
    },
    statusText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
    },
    addToCollectionSection: {
      marginTop: 16,
      alignItems: 'center',
    },
    buttonRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    addToCollectionButton: {
      backgroundColor: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minWidth: 0,
    },
    addToCollectionButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.card,
      textAlign: 'center',
    },
    cancelButton: {
      backgroundColor: colors.textMuted,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
    },
    cancelButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.card,
      textAlign: 'center',
    },
    summaryCard: {
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.accent,
      marginTop: 16,
    },
    summaryTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
      marginBottom: 4,
    },
    summaryText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption1,
      color: colors.textMuted,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.callout,
      color: colors.textMuted,
      marginTop: 16,
      textAlign: 'center',
    },
    errorText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.error,
      marginTop: 8,
      textAlign: 'center',
    },
    warningText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.warning,
      marginTop: 8,
      textAlign: 'center',
    },
    successText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.success,
      marginTop: 8,
      textAlign: 'center',
    },
    stickyActionButtons: {
      backgroundColor: colors.card,
      padding: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 3,
    },
    gameAlreadyInCollection: {
      opacity: 0.5,
    },
    greyedOutImage: {
      opacity: 0.7,
    },
    greyedOutText: {
      color: colors.textMuted,
    },
    alreadyInCollectionText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.caption2,
      color: colors.textMuted,
      marginTop: 4,
    },
    successView: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    successIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    successIcon: {
      fontSize: 40,
      color: colors.card,
      fontFamily: typography.getFontFamily('semibold'),
    },
    successTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 8,
    },
    successMessage: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    okButton: {
      backgroundColor: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    okButtonText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.card,
    },
  });
};