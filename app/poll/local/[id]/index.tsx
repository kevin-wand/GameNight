import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import React, { useState, useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { supabase } from '@/services/supabase';
import { usePollData, VoteType } from '@/hooks/usePollData';
import { VoterNameInput } from '@/components/PollVoterNameInput';
import { GameCard } from '@/components/PollGameCard';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

export default function LocalPollScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const {
    poll,
    games,
    loading,
    error,
    pendingVotes,
    setPendingVotes,
    reload,
  } = usePollData(id);

  const [voterName, setVoterName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState('');

  const handleVote = (gameId: number, voteType: VoteType) => {
    setPendingVotes(prev => {
      const updated = { ...prev };
      if (updated[gameId] === voteType) {
        delete updated[gameId];
      } else {
        updated[gameId] = voteType;
      }
      return updated;
    });
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
      const trimmedName = voterName.trim();
      if (!trimmedName) {
        setNameError(true);
        Toast.show({ type: 'error', text1: 'Please enter your name' });
        return;
      }
      const finalName = trimmedName;
      for (const [gameIdStr, voteType] of Object.entries(pendingVotes)) {
        const gameId = parseInt(gameIdStr, 10);
        const { data: existing, error: selectError } = await supabase
          .from('votes')
          .select('id, vote_type')
          .eq('poll_id', id)
          .eq('game_id', gameId)
          .eq('voter_name', finalName);
        if (selectError) throw selectError;
        if (existing && existing.length > 0) {
          const vote = existing[0];
          if (vote.vote_type !== voteType) {
            const { error: updateError } = await supabase
              .from('votes')
              .update({ vote_type: voteType })
              .eq('id', vote.id);
            if (updateError) throw updateError;
          }
        } else {
          const { error: insertError } = await supabase.from('votes').insert({
            poll_id: id,
            game_id: gameId,
            vote_type: voteType,
            voter_name: finalName,
          });
          if (insertError) throw insertError;
        }
      }
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
      setComment('');
      setVoterName('');
      setPendingVotes({});
      Toast.show({ type: 'success', text1: 'Votes submitted! Hand the device to the next voter.' });
      await reload();
    } catch (err) {
      console.error('Error submitting votes:', err);
      Toast.show({ type: 'error', text1: 'Failed to submit votes' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!poll) return <ErrorState message="Poll not found." onRetry={reload} />;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{poll?.title}</Text>
        {!!poll?.description && <Text style={styles.description}>{poll.description}</Text>}
        <Text style={styles.subtitle}>Local Voting Mode: Enter your name, vote, and pass the device to the next voter!</Text>
      </View>
      <VoterNameInput
        value={voterName}
        onChange={(text) => {
          setVoterName(text);
          if (nameError) setNameError(false);
        }}
        hasError={nameError}
      />
      <View style={styles.gamesContainer}>
        {games.length === 0 ? (
          <Text style={styles.noGamesText}>No games found in this poll.</Text>
        ) : (
          games.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              index={i}
              selectedVote={pendingVotes[game.id]}
              onVote={handleVote}
              disabled={submitting}
            />
          ))
        )}
      </View>
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
          <TouchableOpacity
            style={styles.viewResultsButton}
            onPress={() => router.push(`/poll/${id}/results?local=1` as any)}
          >
            <Text style={styles.viewResultsButtonText}>View Results</Text>
          </TouchableOpacity>
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
    paddingBottom: 0,
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
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  submitVotesButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
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
  viewResultsButton: {
    backgroundColor: '#ff9654',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 12,
  },
  viewResultsButtonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
  },
}); 