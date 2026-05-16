// app/challenge/[matchId].js
//
// This route handles ALL challenge deep links:
//   https://wordblast.app/challenge/ABC123   ← Universal Link / App Link
//   wordblast://challenge/ABC123             ← Custom scheme fallback
//
// Flow:
//   App installed  → OS opens this route directly → auto-joins match
//   App not installed → OS opens browser → shows install page with link preserved
//
// The matchId is extracted from the URL by expo-router automatically.
// We immediately redirect to index with joinMatchId param — no manual entry.

import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ChallengeRoute() {
  const { matchId } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!matchId) {
      router.replace('/');
      return;
    }
    // Redirect to home screen with the matchId as a param.
    // The index screen detects joinMatchId and auto-triggers guest join —
    // recipient never manually types anything.
    router.replace({
      pathname: '/',
      params: { joinMatchId: String(matchId).toUpperCase() },
    });
  }, [matchId]);

  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>💥</Text>
      <Text style={styles.title}>Word Blast</Text>
      <Text style={styles.sub}>Opening challenge…</Text>
      <ActivityIndicator color="#bdb2ff" size="large" style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef6ff', padding: 24 },
  emoji: { fontSize: 60, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: '#2d1b69', marginTop: 8 },
  sub:   { fontSize: 16, color: '#8b7bb8', fontWeight: '600', marginTop: 8 },
});
