import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../src/store';
import { Button } from '../../src/components/UI';

const COLORS = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  secondary: '#EC4899',
  background: '#0F172A',
  backgroundLight: '#1E293B',
  card: '#1E293B',
  cardLight: '#334155',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  success: '#10B981',
  error: '#EF4444',
  border: '#334155',
};

export default function FriendsScreen() {
  const { friends, friendRequests, fetchFriends, fetchFriendRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);
  const [playerId, setPlayerId] = useState('');
  const [loading, setLoading] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriends();
    await fetchFriendRequests();
    setRefreshing(false);
  };

  const handleSendRequest = async () => {
    if (!playerId.trim()) {
      Alert.alert('Hata', 'Oyuncu ID gerekli');
      return;
    }
    
    setLoading(true);
    const success = await sendFriendRequest(playerId.trim());
    setLoading(false);
    
    if (success) {
      setPlayerId('');
      Alert.alert('Başarılı', 'Arkadaşlık isteği gönderildi!');
    } else {
      Alert.alert('Hata', 'İstek gönderilemedi. Oyuncu bulunamadı veya zaten arkadaşsınız.');
    }
  };

  const handleAccept = async (requestId: string) => {
    const success = await acceptFriendRequest(requestId);
    if (success) {
      Alert.alert('Başarılı', 'Arkadaşlık isteği kabul edildi!');
    }
  };

  const handleReject = async (requestId: string) => {
    const success = await rejectFriendRequest(requestId);
    if (success) {
      Alert.alert('Bilgi', 'Arkadaşlık isteği reddedildi');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.secondary, '#F472B6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Arkadaşlar</Text>
        <View style={styles.headerStats}>
          <View style={styles.statBadge}>
            <Ionicons name="people" size={16} color="#fff" />
            <Text style={styles.statBadgeText}>{friends.length}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Add Friend Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arkadaş Ekle</Text>
          <View style={styles.addFriendCard}>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={playerId}
                onChangeText={setPlayerId}
                placeholder="Oyuncu ID girin (örn: PLR123ABC)"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
              />
            </View>
            <Button
              title={loading ? 'Gönderiliyor...' : 'İstek Gönder'}
              onPress={handleSendRequest}
              loading={loading}
              icon="person-add"
              fullWidth
            />
          </View>
        </View>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Bekleyen İstekler ({friendRequests.length})
            </Text>
            {friendRequests.map((request) => (
              <View key={request.request_id} style={styles.requestCard}>
                <View style={styles.requestUser}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.from_user?.name?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{request.from_user?.name || 'Bilinmeyen'}</Text>
                    <Text style={styles.userPlayerId}>{request.from_user?.player_id}</Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(request.request_id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(request.request_id)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Friends List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arkadaşlarım ({friends.length})</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Henüz arkadaşınız yok</Text>
              <Text style={styles.emptyHint}>
                Oyuncu ID kullanarak arkadaş ekleyin
              </Text>
            </View>
          ) : (
            friends.map((friend) => (
              <View key={friend.user_id} style={styles.friendCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {friend.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.name}</Text>
                  <Text style={styles.friendPlayerId}>{friend.player_id}</Text>
                </View>
                <View style={styles.friendScore}>
                  <Text style={styles.scoreValue}>{friend.weekly_score || 0}</Text>
                  <Text style={styles.scoreLabel}>puan</Text>
                </View>
              </View>
            ))
          )}
        </View>

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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStats: {
    flexDirection: 'row',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statBadgeText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 6,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  addFriendCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
  },
  inputRow: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.cardLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  userPlayerId: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  friendPlayerId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  friendScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  scoreLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
  },
});
