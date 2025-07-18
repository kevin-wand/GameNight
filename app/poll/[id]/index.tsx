// poll/PollScreen.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { usePollData, VoteType } from '@/hooks/usePollData';
import { VoterNameInput } from '@/components/PollVoterNameInput';
import { GameCard } from '@/components/PollGameCard';
import { PollResultsButton } from '@/components/PollResultsButton';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { getOrCreateAnonId } from '@/utils/anon';
import { BarChart3 } from 'lucide-react-native';

export default function PollScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const {
    poll,
    games,
    hasVoted,
    isCreator,
    loading,
    error,
    user,
    pendingVotes,
    setPendingVotes,
    reload,
  } = usePollData(id);

  const [voterName, setVoterName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    (async () => {
      // Single device: prefill with user email/username if logged in
      if (user && (user.email || user.username)) {
        setVoterName(user.username || user.email);
      } else {
        const savedName = await AsyncStorage.getItem('voter_name');
        if (savedName) setVoterName(savedName);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (poll && poll.user_id) {
      // Fetch the creator's email or name from Supabase auth.users
      (async () => {
        try {
          const { data, error } = await supabase
            .from('profiles') // Try profiles table first
            .select('username, email')
            .eq('id', poll.user_id)
            .maybeSingle();
          if (data) {
            setCreatorName(data.username || data.email || null);
          } else {
            // Fallback: try auth.users
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(poll.user_id);
            if (userData && userData.user) {
              setCreatorName(userData.user.email || null);
            }
          }
        } catch (e) {
          setCreatorName(null);
        }
      })();
    }
  }, [poll]);

  const handleVote = async (gameId: number, voteType: VoteType) => {
    const currentVoterName = user && user.email ? user.email : voterName.trim();
    if (pendingVotes[gameId] === voteType) {
      setPendingVotes(prev => {
        const updated = { ...prev };
        delete updated[gameId];
        return updated;
      });
      // Delete the vote from the database for this voter/game[]
      if (currentVoterName) {
        try {
          await supabase
            .from('votes')
            .delete()
            .eq('poll_id', id)
            .eq('game_id', gameId)
            .eq('voter_name', currentVoterName);
        } catch (err) {
          console.error('Error deleting vote:', err);
        }
      }
    } else {
      setPendingVotes(prev => {
        const updated = { ...prev };
        updated[gameId] = voteType;
        return updated;
      });
    }
  };

  const submitAllVotes = async () => {
    if (Object.keys(pendingVotes).length === 0) {
      Toast.show({
        type: 'error',
        text1: 'No votes selected',
        text2: 'Please vote for at least one game before submitting.',
        visibilityTime: 4000,
        autoHide: true,
      });
      return;
    }
    try {
      setSubmitting(true);
      const currentVoterName = user && user.email ? user.email : voterName.trim();
      if (!currentVoterName) {
        setNameError(true);
        Toast.show({ type: 'error', text1: 'Please enter your name' });
        return;
      }
      const finalName = currentVoterName;
      for (const [gameIdStr, voteType] of Object.entries(pendingVotes)) {
        const gameId = parseInt(gameIdStr, 10);

        console.log(`Processing vote for game ${gameId}: ${voteType}`);

        // Check for existing vote
        const { data: existing, error: selectError } = await supabase
          .from('votes')
          .select('id, vote_type')
          .eq('poll_id', id)
          .eq('game_id', gameId)
          .eq('voter_name', finalName);

        if (selectError) {
          console.error('Error checking existing votes:', selectError);
          throw selectError;
        }

        console.log('Existing votes found:', existing);

        if (existing && existing.length > 0) {
          const vote = existing[0];
          console.log('vote.vote_type:', vote.vote_type);
          console.log('voteType:', voteType);
          if (vote.vote_type !== voteType) {
            console.log(`Updating existing vote ${vote.id} from ${vote.vote_type} to ${voteType}`);
            const { error: updateError } = await supabase
              .from('votes')
              .update({ vote_type: voteType })
              .eq('id', vote.id);

            if (updateError) {
              console.error('Error updating vote:', updateError);
              throw updateError;
            }
          } else {
            console.log('Vote already exists with same type, skipping');
          }
        } else {
          console.log(`Creating new vote for game ${gameId}`);
          const { error: insertError } = await supabase.from('votes').insert({
            poll_id: id,
            game_id: gameId,
            vote_type: voteType,
            voter_name: finalName,
          });
          if (insertError) throw insertError;
        }
      }
      // Save voter name for future use (only for anonymous)
      if (!user) {
        await AsyncStorage.setItem('voter_name', finalName);
      }
      // Insert comment if present
      if (comment.trim()) {
        const { error: commentError } = await supabase.from('poll_comments').insert({
          poll_id: id,
          voter_name: finalName,
          comment_text: comment.trim(),
        });
        if (commentError) {
          Toast.show({ type: 'error', text1: 'Failed to submit comment' });
        }
      }
      // Mark as voted in local storage for results access
      await AsyncStorage.setItem(`voted_${id}`, 'true');
      await reload();
      setComment(''); // Clear comment after successful submission
      Toast.show({ type: 'success', text1: 'Votes submitted!' });
    } catch (err) {
      console.error('Error submitting votes:', err);
      Toast.show({ type: 'error', text1: 'Failed to submit votes' });
    } finally {
      setSubmitting(false);
    }
  };

  // Remove finishMultiUserVoting and multi-user session logic

  const navigateToResults = () => {
    router.push({ pathname: '/poll/[id]/results', params: { id: id as string } });
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!poll) return <ErrorState message="Poll not found." onRetry={reload} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {poll?.title === 'Vote on games' && games && games.length > 0
            ? `Vote on games (${games.length} game${games.length === 1 ? '' : 's'})`
            : poll?.title}
        </Text>
        {!!poll?.description && <Text style={styles.description}>{poll.description}</Text>}
        {/* Show creator for non-creator users */}
        {!isCreator && creatorName && (
          <Text style={[styles.subtitle, { marginBottom: 2, color: '#ff9654' }]}>Poll created by {creatorName}</Text>
        )}
        <Text style={styles.subtitle}>
          {isCreator
            ? (creatorName ? `Poll created by ${creatorName}` : 'Poll created by you')
            : 'Vote for as many games as you like! ❤️ = Excited, 👍 = Would play, 👎 = Not Interested'}
        </Text>
      </View>

      {/* Always show voter name input */}
      <VoterNameInput
        value={voterName}
        onChange={(text) => {
          if (!user) {
            setVoterName(text);
            if (nameError) setNameError(false);
          }
        }}
        hasError={nameError}
      />
      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>
          Want to create your own polls?{' '}
        </Text>
        <TouchableOpacity onPress={() => router.push('/auth/register')}>
          <Text style={styles.signUpLink}>Sign up for free</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.gamesContainer}>
        {games.length === 0 ? (
          <Text style={styles.noGamesText}>No games found in this poll.</Text>
        ) : (
          games.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              index={i}
              selectedVote={pendingVotes[game.id] ?? game.userVote}
              onVote={handleVote}
              disabled={submitting}
            />
          ))
        )}
      </View>
      {/* Comments Field */}
      <View style={styles.commentContainer}>
        <Text style={styles.commentLabel}>Comments (optional):</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Add any comments about your vote..."
          multiline
          editable={!submitting}
        />
      </View>

      {/* Shared button container for consistent width and padding */}
      <View style={{ paddingHorizontal: 0, width: '100%', alignSelf: 'stretch' }}>
        <View style={styles.submitVotesContainer}>
          <TouchableOpacity
            style={styles.submitVotesButton}
            onPress={submitAllVotes}
            disabled={submitting}
          >
            <Text style={styles.submitVotesButtonText}>
              {submitting ? 'Submitting...' : 'Submit My Votes'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomActionsContainer}>
          {hasVoted && (
            <View style={styles.viewResultsContainer}>
              <PollResultsButton
                onPress={navigateToResults}
              />
            </View>
          )}

          {!hasVoted && (
            <View style={styles.viewResultsContainer}>
              <TouchableOpacity
                style={styles.viewResultsButton}
                onPress={navigateToResults}
              >
                <BarChart3 size={20} color="#ffffff" />
                <Text style={styles.viewResultsButtonText}>View Results</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  header: { padding: 20, backgroundColor: '#1a2b5f' },
  title: { fontSize: 24, fontFamily: 'Poppins-Bold', color: '#fff', marginBottom: 8 },
  description: { fontSize: 16, fontFamily: 'Poppins-Regular', color: '#fff', marginBottom: 12 },
  subtitle: { fontSize: 14, fontFamily: 'Poppins-Regular', color: '#fff', opacity: 0.8 },
  gamesContainer: {
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 0, // Reduce bottom padding by 50%
  },
  noGamesText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#666666',
    textAlign: 'center',
    marginTop: 32,
  },
  submitVotesContainer: {
    paddingTop: 10,
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 0,
    width: '100%', alignSelf: 'stretch'
  },
  submitVotesButton: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%', // Make button full width
    alignSelf: 'stretch',
  },
  submitVotesButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
  },
  bottomActionsContainer: { width: '100%', alignSelf: 'stretch', marginTop: 8 },
  viewResultsContainer: { marginTop: 8, width: '100%', alignSelf: 'stretch' },
  viewResultsButton: {
    backgroundColor: '#ff9654',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%', // Make button full width
    alignSelf: 'stretch',
  },
  viewResultsButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
  },
  signUpContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666666',
  },
  signUpLink: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#ff9654',
    textDecorationLine: 'underline',
  },
  commentContainer: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 20,
    width: '100%',
  },
  commentLabel: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a2b5f',
    marginBottom: 4,
  },
  commentInput: {
    minHeight: 48,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    backgroundColor: '#fff',
    color: '#1a2b5f',
  },
});