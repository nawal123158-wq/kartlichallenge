import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../src/store';
import { User } from '../../src/types';

const COLORS = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  secondary: '#EC4899',
  gold: '#F59E0B',
  silver: '#94A3B8',
  bronze: '#D97706',
  background: '#0F172A',
  backgroundLight: '#1E293B',
  card: '#1E293B',
  cardLight: '#334155',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
};

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function LeaderboardScreen() {
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/users/leaderboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (error) {
      console.error('Fetch leaderboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { color: COLORS.gold, icon: 'trophy' };
    if (rank === 2) return { color: COLORS.silver, icon: 'medal' };
    if (rank === 3) return { color: COLORS.bronze, icon: 'medal' };
    return null;
  };

  const myRank = leaderboard.findIndex(u => u.user_id === user?.user_id) + 1;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.gold, '#FBBF24']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Ionicons name="trophy" size={32} color="#fff" />
          <Text style={styles.headerTitle}>Haftalık Sıralama</Text>
        </View>
        {myRank > 0 && (
          <View style={styles.myRankBadge}>
            <Text style={styles.myRankText}>#{myRank}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          <View style={[styles.podiumItem, styles.podiumSecond]}>
            <View style={[styles.podiumAvatar, { backgroundColor: COLORS.silver }]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboard[1]?.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Ionicons name="medal" size={24} color={COLORS.silver} />
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[1]?.name}</Text>
            <Text style={styles.podiumScore}>{leaderboard[1]?.weekly_score || 0}</Text>
            <View style={[styles.podiumBar, { height: 60, backgroundColor: COLORS.silver + '40' }]} />
          </View>

          {/* 1st Place */}
          <View style={[styles.podiumItem, styles.podiumFirst]}>
            <View style={[styles.podiumAvatar, { backgroundColor: COLORS.gold }]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboard[0]?.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Ionicons name="trophy" size={32} color={COLORS.gold} />
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[0]?.name}</Text>
            <Text style={styles.podiumScore}>{leaderboard[0]?.weekly_score || 0}</Text>
            <View style={[styles.podiumBar, { height: 80, backgroundColor: COLORS.gold + '40' }]} />
          </View>

          {/* 3rd Place */}
          <View style={[styles.podiumItem, styles.podiumThird]}>
            <View style={[styles.podiumAvatar, { backgroundColor: COLORS.bronze }]}>
              <Text style={styles.podiumAvatarText}>
                {leaderboard[2]?.name?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <Ionicons name="medal" size={24} color={COLORS.bronze} />
            <Text style={styles.podiumName} numberOfLines={1}>{leaderboard[2]?.name}</Text>
            <Text style={styles.podiumScore}>{leaderboard[2]?.weekly_score || 0}</Text>
            <View style={[styles.podiumBar, { height: 40, backgroundColor: COLORS.bronze + '40' }]} />
          </View>
        </View>
      )}

      {/* Rest of Leaderboard */}
      <ScrollView
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {leaderboard.slice(3).map((player, index) => {
          const rank = index + 4;
          const isMe = player.user_id === user?.user_id;
          
          return (
            <View 
              key={player.user_id} 
              style={[styles.listItem, isMe && styles.listItemMe]}
            >
              <Text style={[styles.rank, isMe && styles.rankMe]}>#{rank}</Text>
              <View style={styles.listAvatar}>
                <Text style={styles.listAvatarText}>
                  {player.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.listInfo}>
                <Text style={[styles.listName, isMe && styles.listNameMe]}>
                  {player.name}
                  {isMe && ' (Sen)'}
                </Text>
                <Text style={styles.listPlayerId}>{player.player_id}</Text>
              </View>
              <View style={styles.listScore}>
                <Text style={[styles.scoreValue, isMe && styles.scoreValueMe]}>
                  {player.weekly_score || 0}
                </Text>
                <Text style={styles.scoreLabel}>puan</Text>
              </View>
            </View>
          );
        })}

        {leaderboard.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Henüz sıralama yok</Text>
            <Text style={styles.emptyHint}>
              Oyun oynayarak puan kazanın!
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  myRankBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  myRankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: COLORS.backgroundLight,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  podiumFirst: {
    marginTop: -20,
  },
  podiumSecond: {},
  podiumThird: {},
  podiumAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  podiumAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 4,
    maxWidth: 80,
    textAlign: 'center',
  },
  podiumScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 2,
  },
  podiumBar: {
    width: '80%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 8,
  },
  listContainer: {
    flex: 1,
    padding: 20,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listItemMe: {
    backgroundColor: COLORS.primary + '20',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  rank: {
    width: 36,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  rankMe: {
    color: COLORS.primary,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  listNameMe: {
    color: COLORS.primary,
  },
  listPlayerId: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  listScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  scoreValueMe: {
    color: COLORS.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 8,
  },
});
