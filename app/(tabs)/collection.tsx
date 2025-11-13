import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import SFSymbolIcon from '@/components/SFSymbolIcon';
;
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';

import { supabase } from '@/services/supabase';
import { GameItem } from '@/components/GameItem';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyStateCollection } from '@/components/EmptyStateCollection';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { FilterGameModal } from '@/components/FilterGameModal';
import { useGameFilters } from '@/utils/filterOptions';
import { AddGameModal } from '@/components/AddGameModal';
import { CreatePollModal } from '@/components/CreatePollModal';
import { SyncModal } from '@/components/SyncModal';
import { Game } from '@/types/game';
import { sortGamesByTitle } from '@/utils/sortingUtils';
import { fetchGames } from '@/services/bggApi';

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const { colors, typography } = useTheme();
  const { announceForAccessibility, isReduceMotionEnabled, getReducedMotionStyle } = useAccessibility();
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  // Use fallback values for web platform
  const safeAreaBottom = Platform.OS === 'web' ? 0 : insets.bottom;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [addGameModalVisible, setAddGameModalVisible] = useState(false);
  const [createPollModalVisible, setCreatePollModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    stage: 'connecting' | 'fetching' | 'processing' | 'saving' | 'complete';
    message: string;
    progress?: number;
  } | null>(null);

  const router = useRouter();

  // Filter state management
  const {
    filters: rangeFilters,
    setFilters: setRangeFilters,
    clearFilters: clearRangeFilters,
    applyFilters: applyRangeFilters,
  } = useGameFilters();

  const loadGames = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Use setTimeout to ensure router is ready
        setTimeout(() => {
          router.replace('/auth/login');
        }, 0);
        return;
      }

      const { data, error } = await supabase
        .from('collections_games_expansions')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })
        .order('bgg_game_id', { ascending: true })
        .order('is_expansion_owned', { ascending: false })
        .order('expansion_name', { ascending: true })

      if (error) throw error;

      // Group games by bgg_game_id using a compatible approach
      const gameGroups = new Map();
      (data || []).forEach(game => {
        const key = game.bgg_game_id;
        if (!gameGroups.has(key)) {
          gameGroups.set(key, []);
        }
        gameGroups.get(key).push(game);
      });

      const mappedGames = Array.from(gameGroups.values()).map((gameGroup) => {
        let game = gameGroup[0];

        let expansions = gameGroup
          .filter((row: any) => row.expansion_id)
          .map((row: any) => ({
            id: row.expansion_id,
            name: row.expansion_name,
            min_players: row.expansion_min_players,
            max_players: row.expansion_max_players,
            is_owned: row.is_expansion_owned,
            thumbnail: row.expansion_thumbnail,
          }));

        let mins = gameGroup
          .filter((row: any) => row.is_expansion_owned)
          .map((row: any) => row.expansion_min_players)
          .sort((a: number, b: number) => a - b);
        let min_exp_players = mins.length ? mins[0] : null;

        let maxs = gameGroup
          .filter((row: any) => row.is_expansion_owned)
          .map((row: any) => row.expansion_max_players)
          .sort((a: number, b: number) => b - a);
        let max_exp_players = maxs.length ? maxs[0] : null;

        return {
          id: game.bgg_game_id,
          name: game.name,
          yearPublished: game.year_published,
          // Use BGG's "NO IMAGE AVAILABLE" as a fallback
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
          bayesaverage: game.bayesaverage,
          min_exp_players: min_exp_players,
          max_exp_players: max_exp_players,
          expansions: expansions,
        }
      });

      // Sort games alphabetically by title, ignoring articles
      const sortedGames = sortGamesByTitle(mappedGames);
      setAllGames(sortedGames);
      setGames(sortedGames); // Set initial games directly

    } catch (err) {
      console.error('Error in loadGames:', err);
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
      setRefreshing(false);

    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!gameToDelete) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('bgg_game_id', gameToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setAllGames(prevGames => prevGames.filter(game => game.id !== gameToDelete.id));
      setGames(prevGames => prevGames.filter(game => game.id !== gameToDelete.id));
    } catch (err) {
      console.error('Error deleting game:', err);
    } finally {
      setGameToDelete(null);
    }
  }, [gameToDelete]);

  // Reactive filtering - apply filters whenever allGames or rangeFilters change
  useEffect(() => {
    if (allGames.length > 0) {
      const filteredGames = applyRangeFilters(allGames);
      setGames(filteredGames);
    }
  }, [allGames, applyRangeFilters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      (rangeFilters.playerCount?.min != null) ||
      (rangeFilters.playerCount?.max != null) ||
      (rangeFilters.minAge?.min != null) ||
      (rangeFilters.minAge?.max != null) ||
      (rangeFilters.complexity?.min != null) ||
      (rangeFilters.complexity?.max != null) ||
      (rangeFilters.playTime?.min != null) ||
      (rangeFilters.playTime?.max != null) ||
      (rangeFilters.gameType && rangeFilters.gameType.length > 0)
    );
  }, [rangeFilters]);

  // Clear filters function
  const clearFilters = () => {
    clearRangeFilters();
    announceForAccessibility('All filters cleared. Showing all games.');
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGames();
  }, [loadGames]);

  const handleSync = useCallback(async (username: string) => {
    try {
      setSyncing(true);
      setSyncProgress({
        stage: 'connecting',
        message: 'Connecting to BoardGameGeek...',
        progress: 10,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login');
        return;
      }

      if (!username || !username.trim()) {
        throw new Error('Please enter a valid BoardGameGeek username');
      }

      username = username.replace('@', ''); // Remove @ if present

      setSyncProgress({
        stage: 'fetching',
        message: 'Fetching your collection from BGG...',
        progress: 30,
      });

      const bggGames = await fetchGames(username);

      if (!bggGames || bggGames.length === 0) {
        throw new Error('No games found in collection. Make sure your collection is public and contains board games.');
      }

      setSyncProgress({
        stage: 'processing',
        message: `Processing ${bggGames.length} games...`,
        progress: 60,
      });

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

      setSyncProgress({
        stage: 'saving',
        message: 'Saving games to your collection...',
        progress: 80,
      });

      const { error: insertError } = await supabase
        .from('collections')
        .upsert(uniqueGamesList, { onConflict: 'user_id,bgg_game_id' });

      if (insertError) throw insertError;

      setSyncProgress({
        stage: 'complete',
        message: 'Collection imported successfully!',
        progress: 100,
      });

      // Wait a moment to show completion, then refresh and close modal
      setTimeout(async () => {
        await loadGames();
        setSyncModalVisible(false);
        setSyncProgress(null);
        setSyncing(false);
      }, 1500);

    } catch (err) {
      console.error('Error in handleSync:', err);
      setSyncProgress({
        stage: 'complete',
        message: err instanceof Error ? err.message : 'Failed to sync collection',
        progress: 0,
      });
      setSyncing(false);
    }
  }, [loadGames, router]);

  // TODO: Re-add filter conversion in Phase 3
  // const convertFiltersForPoll = useMemo(() => {
  //   return rangeFilters;
  // }, [rangeFilters]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);


  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadGames} />;
  }

  if ((!filterModalVisible) && allGames.length === 0 && !loading) {
    return (
      <EmptyStateCollection
        username={null}
        onRefresh={loadGames}
        loadGames={loadGames}
        message={undefined}
        buttonText={undefined}
        showSyncButton={true}
        handleClearFilters={clearFilters}
      />
    );
  }

  const styles = getStyles(colors, typography);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.countText}>
            {games.length} {games.length === 1 ? 'game' : 'games'}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsSection}
        >
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
            accessibilityLabel="Filter games"
            accessibilityRole="button"
            accessibilityHint="Open filter options to narrow down your game collection"
          >
            <SFSymbolIcon name="listfilter" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setAddGameModalVisible(true)}
            accessibilityLabel="Add game"
            accessibilityRole="button"
            accessibilityHint="Add a new game to your collection"
          >
            <SFSymbolIcon name="plus" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createPollButton}
            onPress={() => setCreatePollModalVisible(true)}
            accessibilityLabel="Create poll"
            accessibilityRole="button"
            accessibilityHint="Create a new voting poll with selected games"
          >
            <SFSymbolIcon name="plus" />
            <Text style={styles.createPollButtonText}>Create Poll</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {hasActiveFilters && (
        <View style={styles.filterBanner}>
          <View style={styles.filterBannerContent}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setFilterModalVisible(true)}
              accessibilityLabel="Edit filters"
              accessibilityRole="button"
              accessibilityHint="Modify or clear current filter settings"
            >
              <Text style={styles.editButtonText}>Edit Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={games}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item, index }) => (
          <View>
            <GameItem
              game={item}
              onDelete={() => setGameToDelete(item)}
              onExpansionUpdate={loadGames}
            />
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: 80 + safeAreaBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      />

      <ConfirmationDialog
        isVisible={gameToDelete !== null}
        title="Delete Game"
        message={`Are you sure you want to remove ${gameToDelete?.name} from your Klack collection?\n\n(This will not affect your BGG collection.)`}
        onConfirm={handleDelete}
        onCancel={() => setGameToDelete(null)}
      />

      <FilterGameModal
        isVisible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={() => setFilterModalVisible(false)}
        title="Filter Your Collection"
        description="All filters (optional)"
        applyButtonText="Filter Games"
        initialFilters={rangeFilters}
        onFiltersChange={setRangeFilters}
      />

      <AddGameModal
        isVisible={addGameModalVisible}
        onClose={() => setAddGameModalVisible(false)}
        onGameAdded={loadGames}
        userCollectionIds={allGames.map(g => g.id.toString())}
      />

      <CreatePollModal
        isVisible={createPollModalVisible}
        onClose={() => setCreatePollModalVisible(false)}
        onSuccess={(pollType) => {
          setCreatePollModalVisible(false);
          // Navigate to polls tab with refresh parameter
          router.push('/(tabs)/polls?refresh=true');
        }}
        initialFilters={rangeFilters}
      />

      <SyncModal
        isVisible={syncModalVisible}
        onClose={() => {
          setSyncModalVisible(false);
          setSyncProgress(null);
          setSyncing(false);
        }}
        onSync={handleSync}
        loading={syncing}
        syncProgress={syncProgress}
      />
    </View>
  );
}

const getStyles = (colors: any, typography: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: colors.background,
  },
  titleSection: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontFamily: typography.getFontFamily('bold'),
    fontSize: typography.fontSize.title1,
    color: colors.primary,
    marginBottom: 6,
    lineHeight: typography.lineHeight.tight * typography.fontSize.title1,
  },
  countText: {
    fontFamily: typography.getFontFamily('normal'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    marginBottom: 20,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  actionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    backgroundColor: colors.card,
    minWidth: 44,
    minHeight: 44,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterBanner: {
    backgroundColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.body,
    color: colors.textMuted,
    marginLeft: 6,
    lineHeight: typography.lineHeight.normal * typography.fontSize.body,
  },
  createPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  createPollButtonText: {
    fontFamily: typography.getFontFamily('semibold'),
    fontSize: typography.fontSize.caption,
    color: colors.card,
    lineHeight: typography.lineHeight.normal * typography.fontSize.caption,
    marginLeft: 10,
  },
  listContent: {
    padding: 20,
  },
});