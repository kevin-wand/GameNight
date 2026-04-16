import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Minus, Trophy, Users, RotateCcw, X, Pen, Check } from 'lucide-react-native';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import ToolsFooter from '@/components/ToolsFooter';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

interface Player {
  id: string;
  name: string;
  scores: number[];
  total: number;
}

interface Round {
  roundNumber: number;
  scores: { [playerId: string]: number };
}

type GamePhase = 'setup' | 'playing' | 'finished';

export default function ScoreTrackerScreen() {
  const router = useRouter();
  const { colors, typography, touchTargets } = useTheme();
  const styles = useMemo(() => getStyles(colors, typography, touchTargets), [colors, typography, touchTargets]);
  const { announceForAccessibility } = useAccessibility();
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [roundScores, setRoundScores] = useState<{ [playerId: string]: string }>({});
  const [rounds, setRounds] = useState<Round[]>([]);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);


  const addPlayer = useCallback(() => {
    if (newPlayerName.trim() && !players.some(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
      const newPlayer: Player = {
        id: Date.now().toString(),
        name: newPlayerName.trim(),
        scores: [],
        total: 0,
      };
      setPlayers(prev => [...prev, newPlayer]);
      setNewPlayerName('');
    }
  }, [newPlayerName, players]);

  const removePlayer = useCallback((playerId: string) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
  }, []);

  const startGame = useCallback(() => {
    if (players.length >= 2) {
      setGamePhase('playing');
      // Initialize round scores for all players
      const initialScores: { [playerId: string]: string } = {};
      players.forEach(player => {
        initialScores[player.id] = '';
      });
      setRoundScores(initialScores);
    }
  }, [players]);

  const updateRoundScore = useCallback((playerId: string, score: string) => {
    // Allow negative numbers by accepting minus sign
    if (score === '' || score === '-' || /^-?\d*$/.test(score)) {
      setRoundScores(prev => ({
        ...prev,
        [playerId]: score,
      }));
    }
  }, []);

  const submitRound = useCallback(() => {
    // Validate all scores are entered
    const missingPlayers = players.filter(player =>
      !roundScores[player.id] ||
      roundScores[player.id].trim() === '' ||
      roundScores[player.id] === '-'
    );

    if (missingPlayers.length > 0) {
      const playerNames = missingPlayers.map(p => p.name).join(', ');
      setToastMessage(`Please enter scores for: ${playerNames}`);
      announceForAccessibility(`Missing scores. Please enter scores for: ${playerNames}`);
      return;
    }

    // Convert scores to numbers and update players
    const roundData: Round = {
      roundNumber: currentRound,
      scores: {},
    };

    const updatedPlayers = players.map(player => {
      const score = parseInt(roundScores[player.id]) || 0;
      roundData.scores[player.id] = score;

      return {
        ...player,
        scores: [...player.scores, score],
        total: player.total + score, // This will handle negative numbers correctly
      };
    });

    setPlayers(updatedPlayers);
    setRounds(prev => [...prev, roundData]);
    setCurrentRound(prev => prev + 1);

    // Reset round scores for next round
    const resetScores: { [playerId: string]: string } = {};
    players.forEach(player => {
      resetScores[player.id] = '';
    });
    setRoundScores(resetScores);
  }, [players, roundScores, currentRound]);

  const finishGame = useCallback(() => {
    setConfirmationVisible(false);
    setGamePhase('finished');
  }, []);

  const resetGame = useCallback(() => {
    setConfirmationVisible(false)
    setGamePhase('setup');
    setPlayers([]);
    setNewPlayerName('');
    setCurrentRound(1);
    setRoundScores({});
    setRounds([]);
    setEditingPlayerId(null);
    setEditingPlayerName('');
  }, []);

  const startEditingPlayer = useCallback((player: Player) => {
    setEditingPlayerId(player.id);
    setEditingPlayerName(player.name);
  }, []);

  const savePlayerName = useCallback(() => {
    if (editingPlayerName.trim() && editingPlayerId) {
      setPlayers(prev => prev.map(player =>
        player.id === editingPlayerId
          ? { ...player, name: editingPlayerName.trim() }
          : player
      ));
      setEditingPlayerId(null);
      setEditingPlayerName('');
    }
  }, [editingPlayerName, editingPlayerId]);

  const cancelEditingPlayer = useCallback(() => {
    setEditingPlayerId(null);
    setEditingPlayerName('');
  }, []);

  // Get sorted players by total score (descending)
  const sortedPlayers = [...players].sort((a, b) => b.total - a.total);

  if (gamePhase === 'setup') {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: 'https://images.pexels.com/photos/278918/pexels-photo-278918.jpeg' }}
          style={styles.backgroundImage}
        />
        <View style={styles.overlay} />

        <View style={styles.header}>
          <Text style={styles.title}>Add players to start tracking scores</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.setupSection}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                placeholder="Enter player name"
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={addPlayer}
                maxLength={20}
                accessibilityLabel="Enter player name"
              />
              <TouchableOpacity
                style={[styles.addButton, !newPlayerName.trim() && styles.addButtonDisabled]}
                onPress={addPlayer}
                disabled={!newPlayerName.trim()}
                accessibilityLabel="Add player"
                accessibilityRole="button"
              >
                <Plus color={colors.card} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
              {players.map((player, index) => (
                <Animated.View
                  key={player.id}
                  entering={FadeIn.delay(index * 100)}
                  style={styles.playerItem}
                >
                  {editingPlayerId === player.id ? (
                    <View style={styles.editingContainer}>
                      <TextInput
                        style={styles.editInput}
                        value={editingPlayerName}
                        onChangeText={setEditingPlayerName}
                        onSubmitEditing={savePlayerName}
                        autoFocus
                        maxLength={20}
                        accessibilityLabel="Edit player name"
                      />
                      <TouchableOpacity
                        style={styles.saveButton}
                        onPress={savePlayerName}
                        hitSlop={touchTargets.small}
                        accessibilityLabel="Save player name"
                        accessibilityRole="button"
                      >
                        <Check size={16} color="#10b981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={cancelEditingPlayer}
                        hitSlop={touchTargets.small}
                        accessibilityLabel="Cancel editing"
                        accessibilityRole="button"
                      >
                        <X size={16} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.playerInfo}>
                        <Text style={styles.playerName}>{player.name}</Text>
                      </View>
                      <View style={styles.playerActions}>
                        <TouchableOpacity
                          style={styles.editPlayerButton}
                          onPress={() => startEditingPlayer(player)}
                          hitSlop={touchTargets.small}
                          accessibilityLabel={`Edit ${player.name}`}
                          accessibilityRole="button"
                        >
                          <Pen size={16} color="#ff9654" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removePlayer(player.id)}
                          hitSlop={touchTargets.small}
                          accessibilityLabel={`Remove ${player.name}`}
                          accessibilityRole="button"
                        >
                          <X size={16} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </Animated.View>
              ))}
            </ScrollView>

            {players.length === 0 && (
              <Text style={styles.emptyText}>
                Add at least 2 players to start the game
              </Text>
            )}
          </View>

          {players.length >= 2 && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={startGame}
              accessibilityLabel="Start game"
              accessibilityRole="button"
            >
              <Trophy size={24} color={colors.card} />
              <Text style={styles.startButtonText}>Start Game</Text>
            </TouchableOpacity>
          )}
        </View>
        <ToolsFooter currentScreen="tools" />
      </View>
    );
  }

  if (gamePhase === 'playing') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, styles.gameHeader]}>
          <Text style={styles.title}>Round {currentRound}</Text>
          <Text style={styles.subtitle}>Enter scores for this round</Text>
        </View>

        <ScrollView style={styles.gameContent} showsVerticalScrollIndicator={false}>
          {/* Current Round Score Entry */}
          <View style={styles.roundSection}>
            {players.map((player, index) => (
              <Animated.View
                key={player.id}
                entering={SlideInRight.delay(index * 100)}
                style={styles.roundInputRow}
              >
                <View style={styles.roundPlayerInfo}>
                  <Text style={styles.roundPlayerName}>{player.name}</Text>
                  <Text style={styles.roundPlayerTotal}>Total: {player.total}</Text>
                </View>
                <TextInput
                  style={styles.roundScoreInput}
                  value={roundScores[player.id] || ''}
                  onChangeText={(text) => updateRoundScore(player.id, text)}
                  placeholder=""
                  keyboardType="numbers-and-punctuation"
                  maxLength={6}
                  accessibilityLabel={`Enter score for ${player.name}`}
                />
              </Animated.View>
            ))}

            <View style={styles.roundActions}>
              <TouchableOpacity
                style={styles.submitRoundButton}
                onPress={submitRound}
                accessibilityLabel="Submit round scores"
                accessibilityRole="button"
              >
                <Text style={styles.submitRoundText}>Submit Round</Text>
              </TouchableOpacity>

              {rounds.length > 0 && (
                <TouchableOpacity
                  style={styles.finishGameButton}
                  onPress={() => setConfirmationVisible(true)}
                  accessibilityLabel="Finish game"
                  accessibilityRole="button"
                >
                  <Text style={styles.finishGameText}>Finish Game</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Score History */}
          {rounds.length > 0 && (
            <View style={styles.scoreSection}>
              <Text style={styles.scoreTitle}>Score History</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.scoreTable}>
                  {/* Header Row */}
                  <View style={styles.scoreHeaderRow}>
                    <Text style={styles.scoreHeaderPlayer}>Player</Text>
                    <Text style={styles.scoreHeaderTotal}>Total</Text>
                    {/* Show rounds in reverse order (latest first) */}
                    {[...rounds].reverse().map(round => (
                      <Text key={round.roundNumber} style={styles.scoreHeaderRound}>
                        R{round.roundNumber}
                      </Text>
                    ))}
                  </View>

                  {/* Player Rows */}
                  {sortedPlayers.map((player, index) => (
                    <View key={player.id} style={[
                      styles.scoreRow,
                      index === 0 && styles.scoreLeaderRow
                    ]}>
                      <View style={styles.scoreNameCell}>
                        <Text style={styles.scoreNameText}>
                          {player.name}
                        </Text>
                      </View>
                      <View style={styles.scoreTotalCell}>
                        <Text style={styles.scoreTotalText}>
                          {player.total}
                        </Text>
                      </View>
                      {/* Show scores in reverse order (latest first) */}
                      {[...player.scores].reverse().map((score, scoreIndex) => (
                        <View key={scoreIndex} style={styles.scoreRoundCell}>
                          <Text style={styles.scoreRoundText}>
                            {score}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
        {toastMessage && (
          <Animated.View entering={FadeIn} exiting={SlideOutLeft} style={styles.toastContainer} accessibilityRole="alert">
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}
        <ToolsFooter currentScreen="tools" />

        <ConfirmationDialog
          isVisible={confirmationVisible}
          title="Finish Game"
          message={`Are you sure you want to finish game?`}
          onConfirm={finishGame}
          onCancel={() => setConfirmationVisible(false)}
          confirmButtonText="Finish"
        />
      </View>
    );
  }

  // Finished game phase
  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.resultsHeader]}>
        <Text style={[styles.title, styles.resultsTitle]}>Game Complete!</Text>
        <Text style={[styles.subtitle, styles.resultsSubtitle]}>Final Scores</Text>
      </View>

      <ScrollView style={styles.finishedContent} showsVerticalScrollIndicator={false}>
        <View style={styles.podiumSection}>
          {/* 2nd Place - Left */}
          {sortedPlayers[1] && (
            <Animated.View
              key={sortedPlayers[1].id}
              entering={FadeIn.delay(200)}
              style={[styles.podiumItem, styles.podiumSecond]}
            >
              <Text style={styles.podiumPositionSecond}>🥈</Text>
              <Text style={styles.podiumNameSecond}>{sortedPlayers[1].name}</Text>
              <Text style={styles.podiumScoreSecond}>{sortedPlayers[1].total}</Text>
            </Animated.View>
          )}

          {/* 1st Place - Center */}
          {sortedPlayers[0] && (
            <Animated.View
              key={sortedPlayers[0].id}
              entering={FadeIn.delay(0)}
              style={[styles.podiumItem, styles.podiumFirst]}
            >
              <Text style={styles.podiumPositionFirst}>🥇</Text>
              <Text style={styles.podiumNameFirst}>{sortedPlayers[0].name}</Text>
              <Text style={styles.podiumScoreFirst}>{sortedPlayers[0].total}</Text>
            </Animated.View>
          )}

          {/* 3rd Place - Right */}
          {sortedPlayers[2] && (
            <Animated.View
              key={sortedPlayers[2].id}
              entering={FadeIn.delay(400)}
              style={[styles.podiumItem, styles.podiumThird]}
            >
              <Text style={styles.podiumPositionThird}>🥉</Text>
              <Text style={styles.podiumNameThird}>{sortedPlayers[2].name}</Text>
              <Text style={styles.podiumScoreThird}>{sortedPlayers[2].total}</Text>
            </Animated.View>
          )}
        </View>

        {/* Complete Results Table */}
        <View style={styles.finalResultsSection}>
          <Text style={styles.finalResultsTitle}>Complete Results</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.finalTable}>
              {/* Header */}
              <View style={styles.finalHeaderRow}>
                <Text style={styles.finalHeaderCell}>Rank</Text>
                <Text style={styles.finalHeaderCellPlayer}>Player</Text>
                <Text style={styles.finalHeaderCellTotal}>Total</Text>
                {/* Show rounds in reverse order (latest first) */}
                {[...rounds].reverse().map(round => (
                  <Text key={round.roundNumber} style={styles.finalHeaderCell}>
                    R{round.roundNumber}
                  </Text>
                ))}
              </View>

              {/* Player Rows */}
              {sortedPlayers.map((player, index) => (
                <View key={player.id} style={styles.finalPlayerRow}>
                  <Text style={styles.finalRankCell}>#{index + 1}</Text>
                  <Text style={styles.finalPlayerNameCell}>{player.name}</Text>
                  <Text style={styles.finalTotalCell}>{player.total}</Text>
                  {/* Show scores in reverse order (latest first) */}
                  {[...player.scores].reverse().map((score, scoreIndex) => (
                    <Text key={scoreIndex} style={styles.finalScoreCell}>
                      {score}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.newGameButton}
        onPress={() => setConfirmationVisible(true)}
        accessibilityLabel="Start new game"
        accessibilityRole="button"
      >
        <RotateCcw size={24} color={colors.card} />
        <Text style={styles.newGameButtonText}>New Game</Text>
      </TouchableOpacity>

      <ToolsFooter currentScreen="tools" />

      <ConfirmationDialog
        isVisible={confirmationVisible}
        title="New Game"
        message={`Are you sure you want to reset the tracker and start a new game?`}
        onConfirm={resetGame}
        onCancel={() => setConfirmationVisible(false)}
        confirmButtonText="Reset"
      />

    </View>
  );
}


function getStyles(colors: any, typography: any, touchTargets: any) {
  return StyleSheet.create({
    // === TOAST ===
    toastContainer: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 80,
      backgroundColor: colors.error,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    toastText: {
      color: colors.card,
      textAlign: 'center',
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
    },
    // === CONTAINER & LAYOUT ===
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backgroundImage: {
      position: 'absolute',
      width: '100%',
      height: 200,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 200,
      backgroundColor: colors.primary + 'D9',
    },

    // === HEADER ===

    header: {
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 10,
      minHeight: 60,
      justifyContent: 'center',
    },
    title: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.headline,
      color: colors.card,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.card,
      textAlign: 'center',
      opacity: 0.9,
    },

    // === MAIN CONTENT ===
    content: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      padding: 20,
    },

    // === SETUP SECTION ===
    setupSection: {
      flex: 1,
    },
    sectionTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },

    // === INPUT CONTAINER ===
    inputContainer: {
      flexDirection: 'row',
      marginBottom: 24,
    },
    input: {
      flex: 1,
      flexShrink: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    addButton: {
      width: 56,
      height: 56,
      backgroundColor: colors.accent,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addButtonDisabled: {
      opacity: 0.7,
    },

    // === PLAYERS LIST ===
    playersList: {
      flex: 1,
      maxHeight: 300,
    },
    playerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    editingContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    editInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
      minHeight: 44,
    },
    playerName: {
      flex: 1,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
    },
    playerActions: {
      flexDirection: 'row',
    },
    deleteButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      backgroundColor: colors.tints.error,
    },
    saveButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      backgroundColor: colors.tints.success,
    },
    cancelButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      backgroundColor: colors.tints.neutral,
    },
    playerInfo: {
      flex: 1,
    },
    editPlayerButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      backgroundColor: colors.tints.neutral,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
      backgroundColor: colors.tints.error,
    },
    emptyText: {
      textAlign: 'center',
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.subheadline,
      color: colors.textMuted,
      marginTop: 32,
    },

    // === START BUTTON ===
    startButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 20,
      minHeight: 44,
    },
    startButtonText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },

    // === GAME HEADER ===
    gameHeader: {
      backgroundColor: colors.accent,
    },
    gameContent: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // === ROUND SECTION ===
    roundSection: {
      padding: 20,
    },
    roundInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 4,
      paddingHorizontal: 16,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    roundPlayerInfo: {
      flex: 1,
    },
    roundPlayerName: {
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
    },
    roundPlayerTotal: {
      fontSize: typography.fontSize.footnote,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.textMuted,
      marginTop: 2,
    },
    roundScoreInput: {
      width: 80,
      backgroundColor: colors.background,
      borderRadius: 8,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('normal'),
      color: colors.text,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },

    // === SUBMIT ROUND / FINISH GAME BUTTONS ===
    roundActions: {
      flexDirection: 'row',
      marginTop: 6,
    },
    submitRoundButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      marginRight: 12,
    },
    submitRoundText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },
    finishGameButton: {
      backgroundColor: colors.error,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    finishGameText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },

    // === SCORE HISTORY ===
    scoreSection: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    scoreTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    scoreTable: {
    },

    // === SCORE HISTORY ROW LAYOUT ===

    scoreHeaderRow: {
      flexDirection: 'row',
      backgroundColor: colors.tints.neutral,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    scoreRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scoreLeaderRow: {
      backgroundColor: colors.tints.success,
    },

    // === SCORE HISTORY PLAYER COLUMN ===

    scoreHeaderPlayer: {
      width: 120,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },

    scoreNameCell: {
      width: 120,
      justifyContent: 'center',
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    scoreNameText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
    },

    // === SCORE HISTORY TOTAL COLUMN ===
    scoreHeaderTotal: {
      width: 100,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    scoreTotalCell: {
      width: 100,
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    scoreTotalText: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
    },

    // === SCORE HISTORY ROUND COLUMN ===
    scoreHeaderRound: {
      width: 50,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.subheadline,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    scoreRoundCell: {
      width: 50,
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    scoreRoundText: {
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
    },

    // === FINISH BUTTON ===
    finishButton: {
      backgroundColor: colors.error,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 20,
      minHeight: 44,
    },
    finishButtonText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },


    // === GAME RESULTS ===
    resultsHeader: {
      backgroundColor: colors.tints.success,
    },
    resultsTitle: {
      color: colors.success,
    },
    resultsSubtitle: {
      color: colors.success,
      opacity: 0.8,
    },
    finishedContent: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // === PODIUM SECTION ===
    podiumSection: {
      padding: 20,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      minHeight: 200,
      gap: 0,
      flex: 1,
    },
    podiumItem: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      alignItems: 'center',
      justifyContent: 'flex-end',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      minHeight: 160,
    },
    // 1st Place - Center (Largest)
    podiumFirst: {
      flex: 1.2,
      padding: 24,
      borderWidth: 3,
      borderColor: colors.warning,
      zIndex: 3,
      marginHorizontal: 2,
      maxWidth: 140,
      minHeight: 180,
      flexGrow: 1.2,
    },
    podiumPositionFirst: {
      fontSize: 48,
      marginBottom: 12,
    },
    podiumNameFirst: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.text,
      marginBottom: 6,
      textAlign: 'center',
    },
    podiumScoreFirst: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title1,
      color: colors.warning,
    },
    // 2nd Place - Left (Medium)
    podiumSecond: {
      flex: 1,
      padding: 18,
      borderWidth: 2,
      borderColor: colors.border,
      zIndex: 2,
      marginRight: 1,
      maxWidth: 120,
      minHeight: 160,
      flexGrow: 1,
    },
    podiumPositionSecond: {
      fontSize: 36,
      marginBottom: 8,
    },
    podiumNameSecond: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 4,
      textAlign: 'center',
    },
    podiumScoreSecond: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title2,
      color: colors.textMuted,
    },
    // 3rd Place - Right (Smallest)
    podiumThird: {
      flex: 0.8,
      padding: 14,
      borderWidth: 2,
      borderColor: colors.accent,
      zIndex: 1,
      marginLeft: 1,
      maxWidth: 100,
      minHeight: 140,
      flexGrow: 0.8,
    },
    podiumPositionThird: {
      fontSize: 28,
      marginBottom: 6,
    },
    podiumNameThird: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.body,
      color: colors.text,
      marginBottom: 3,
      textAlign: 'center',
    },
    podiumScoreThird: {
      fontFamily: typography.getFontFamily('bold'),
      fontSize: typography.fontSize.title3,
      color: colors.accent,
    },

    // === FINAL RESULTS ===
    finalResultsSection: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    finalResultsTitle: {
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.title3,
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    finalTable: {
    },
    finalHeaderRow: {
      flexDirection: 'row',
      backgroundColor: colors.tints.neutral,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    finalHeaderCell: {
      flex: 1,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalHeaderCellPlayer: {
      flex: 2,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalHeaderCellTotal: {
      flex: 1,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalPlayerRow: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    finalRankCell: {
      flex: 1,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalPlayerNameCell: {
      flex: 2,
      padding: 12,
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalTotalCell: {
      flex: 1,
      padding: 12,
      fontFamily: typography.getFontFamily('semibold'),
      fontSize: typography.fontSize.footnote,
      color: colors.accent,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    finalScoreCell: {
      flex: 1,
      padding: 12,
      fontFamily: typography.getFontFamily('normal'),
      fontSize: typography.fontSize.footnote,
      color: colors.text,
      textAlign: 'center',
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },

    // === NEW GAME BUTTON ===
    newGameButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 20,
      minHeight: 44,
    },
    newGameButtonText: {
      color: colors.card,
      fontSize: typography.fontSize.body,
      fontFamily: typography.getFontFamily('semibold'),
      marginLeft: 8,
    },
  });
}