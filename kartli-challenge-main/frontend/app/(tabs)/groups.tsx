import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore, useAuthStore } from '../../src/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Group } from '../../src/types';

import { COLORS } from '../../src/theme';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://kartlichallenge.onrender.com';

export default function GroupsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { groups, fetchGroups, createGroup, joinGroup } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Hata', 'Grup adı gerekli');
      return;
    }
    setLoading(true);
    const group = await createGroup(groupName.trim());
    setLoading(false);
    if (group) {
      setShowCreateModal(false);
      setGroupName('');
      Alert.alert('Başarılı', `${group.name} grubu oluşturuldu!\nDavet Kodu: ${group.invite_code}`);
    } else {
      Alert.alert('Hata', 'Grup oluşturulamadı');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Hata', 'Davet kodu gerekli');
      return;
    }
    setLoading(true);
    const success = await joinGroup(inviteCode.trim());
    setLoading(false);
    if (success) {
      setShowJoinModal(false);
      setInviteCode('');
      Alert.alert('Başarılı', 'Gruba katıldınız!');
    } else {
      Alert.alert('Hata', 'Geçersiz davet kodu veya zaten üyesiniz');
    }
  };

  const fetchGroupDetails = async (groupId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/groups/${groupId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setGroupDetails(data);
      }
    } catch (error) {
      console.error('Fetch group details error:', error);
    }
  };

  const handleGroupPress = async (group: Group) => {
    setSelectedGroup(group);
    await fetchGroupDetails(group.group_id);
    setShowGroupModal(true);
  };

  const handleStartGame = async () => {
    if (!selectedGroup) return;
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/games`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group_id: selectedGroup.group_id })
      });
      
      if (response.ok) {
        const game = await response.json();
        setShowGroupModal(false);
        router.push(`/game/${game.game_id}`);
      } else {
        const error = await response.json();
        Alert.alert('Hata', error.detail || 'Oyun başlatılamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
    setLoading(false);
  };

  const handleShareInvite = async (group: Group) => {
    try {
      const playerId = user?.player_id;
      const code = group.invite_code;
      const link = `frontend://join?code=${encodeURIComponent(code)}${playerId ? `&ref=${encodeURIComponent(playerId)}` : ''}`;
      await Share.share({
        message: `Kartlı Challenge! ${group.name} grubuma katıl: ${link}`,
        url: link,
      });
    } catch {
      Alert.alert('Hata', 'Paylaşım başarısız');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={styles.gradient}
      >
        {/* Header */}
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Gruplarım</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowJoinModal(true)}
            >
              <Text style={styles.headerButtonEmoji}>🚪</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.headerButtonEmoji}>➕</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {groups.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyTitle}>Henüz grubunuz yok</Text>
              <Text style={styles.emptyMessage}>
                Yeni bir grup oluşturun veya davet koduyla bir gruba katılın
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                  <LinearGradient
                    colors={['#8B5CF6', '#A78BFA']}
                    style={styles.emptyButton}
                  >
                    <Text style={styles.emptyButtonText}>Grup Oluştur</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.emptySecondaryButton}
                  onPress={() => setShowJoinModal(true)}
                >
                  <Text style={styles.emptySecondaryButtonText}>Gruba Katıl</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            groups.map((group) => (
              <TouchableOpacity
                key={group.group_id}
                style={styles.groupCard}
                onPress={() => handleGroupPress(group)}
              >
                <LinearGradient
                  colors={[COLORS.cardLight, COLORS.card]}
                  style={styles.groupIcon}
                >
                  <Text style={styles.groupEmoji}>🎮</Text>
                </LinearGradient>

                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMeta}>
                    {group.member_count || 0} üye • Kod: {group.invite_code}
                  </Text>
                </View>

                {group.is_admin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => handleShareInvite(group)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-social" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Create Group Modal */}
        <Modal visible={showCreateModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={[COLORS.backgroundLight, COLORS.card]}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Yeni Grup Oluştur</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Grup Adı</Text>
              <TextInput
                style={styles.input}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Örn: Cuma Akşamı Ekibi"
                placeholderTextColor={COLORS.textMuted}
              />
              
              <TouchableOpacity onPress={handleCreateGroup} disabled={loading}>
                <LinearGradient
                  colors={['#8B5CF6', '#A78BFA']}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Oluşturuluyor...' : 'Grup Oluştur'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* Join Group Modal */}
        <Modal visible={showJoinModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={[COLORS.backgroundLight, COLORS.card]}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Gruba Katıl</Text>
                <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Davet Kodu</Text>
              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="8 haneli kod girin"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
                maxLength={8}
              />
              
              <TouchableOpacity onPress={handleJoinGroup} disabled={loading}>
                <LinearGradient
                  colors={['#22D3EE', '#06B6D4']}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Katılınıyor...' : 'Gruba Katıl'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Modal>

        {/* Group Details Modal */}
        <Modal visible={showGroupModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={[COLORS.backgroundLight, COLORS.card]}
              style={[styles.modalContent, { maxHeight: '80%' }]}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedGroup?.name}</Text>
                <TouchableOpacity onPress={() => setShowGroupModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              {/* Invite Code */}
              <View style={styles.inviteCodeSection}>
                <Text style={styles.inviteCodeLabel}>Davet Kodu</Text>
                <LinearGradient
                  colors={[COLORS.card, COLORS.cardLight]}
                  style={styles.inviteCodeBox}
                >
                  <Text style={styles.inviteCodeText}>{selectedGroup?.invite_code}</Text>
                  <TouchableOpacity>
                    <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              
              {/* Members */}
              <Text style={styles.membersTitle}>Üyeler ({groupDetails?.members?.length || 0})</Text>
              <ScrollView style={styles.membersList}>
                {groupDetails?.members?.map((member: any) => (
                  <View key={member.user_id} style={styles.memberItem}>
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primaryLight]}
                      style={styles.memberAvatar}
                    >
                      <Text style={styles.memberInitial}>
                        {member.name?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </LinearGradient>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {member.name}
                        {member.user_id === user?.user_id && ' (Sen)'}
                      </Text>
                      <Text style={styles.memberScore}>{member.weekly_score || 0} puan</Text>
                    </View>
                    {member.is_admin && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
              
              {/* Start Game / Join Game Button */}
              <View style={styles.modalActions}>
                {groupDetails?.active_game ? (
                  // Active game exists
                  groupDetails.active_game.is_player ? (
                    // Already in the game - go to game
                    <TouchableOpacity onPress={() => {
                      setShowGroupModal(false);
                      router.push(`/game/${groupDetails.active_game.game_id}`);
                    }}>
                      <LinearGradient
                        colors={['#8B5CF6', '#A78BFA']}
                        style={styles.startGameButton}
                      >
                        <Text style={styles.startGameEmoji}>🎮</Text>
                        <Text style={styles.startGameText}>Oyuna Git</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    // Not in the game - join
                    <TouchableOpacity onPress={async () => {
                      setLoading(true);
                      try {
                        const token = await AsyncStorage.getItem('session_token');
                        if (!token) return;
                        
                        const response = await fetch(`${API_URL}/api/games/${groupDetails.active_game.game_id}/join`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (response.ok) {
                          setShowGroupModal(false);
                          router.push(`/game/${groupDetails.active_game.game_id}`);
                        } else {
                          const error = await response.json();
                          Alert.alert('Hata', error.detail || 'Oyuna katılınamadı');
                        }
                      } catch (error) {
                        Alert.alert('Hata', 'Bir hata oluştu');
                      }
                      setLoading(false);
                    }} disabled={loading}>
                      <LinearGradient
                        colors={['#22D3EE', '#06B6D4']}
                        style={styles.startGameButton}
                      >
                        <Text style={styles.startGameEmoji}>🚀</Text>
                        <Text style={styles.startGameText}>
                          {loading ? 'Katılınıyor...' : `Oyuna Katıl (${groupDetails.active_game.player_count} kişi)`}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )
                ) : (
                  // No active game - only admin can start
                  groupDetails?.is_admin ? (
                    <TouchableOpacity onPress={handleStartGame} disabled={loading}>
                      <LinearGradient
                        colors={['#10B981', '#34D399']}
                        style={styles.startGameButton}
                      >
                        <Text style={styles.startGameEmoji}>🎮</Text>
                        <Text style={styles.startGameText}>
                          {loading ? 'Başlatılıyor...' : 'Yeni Oyun Başlat'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.waitingForGame}>
                      <Text style={styles.waitingText}>⏳ Admin oyun başlatmayı bekliyor</Text>
                    </View>
                  )
                )}
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonEmoji: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  emptyActions: {
    width: '80%',
    gap: 14,
  },
  emptyButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySecondaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  emptySecondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmoji: {
    fontSize: 26,
  },
  groupInfo: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  groupMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  adminBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginRight: 10,
  },
  adminBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  modalButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteCodeSection: {
    marginBottom: 20,
  },
  inviteCodeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  inviteCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 16,
  },
  inviteCodeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 4,
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 14,
  },
  membersList: {
    maxHeight: 200,
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  memberScore: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalActions: {
    marginTop: 8,
  },
  startGameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  startGameEmoji: {
    fontSize: 22,
  },
  startGameText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  waitingForGame: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  waitingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
});
