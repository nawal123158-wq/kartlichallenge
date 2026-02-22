import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../../src/config';

import { Button, EmptyState, Input } from '../../src/components/UI';

import { COLORS } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, notifications, logout, markAllNotificationsRead, setUser } = useAuthStore();
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          }
        }
      ]
    );
  };

  const handleEditProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Hata', 'İsim boş olamaz');
      return;
    }
    
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      // Note: Backend'de update endpoint yoksa eklenebilir
      // Şimdilik sadece local state güncelleniyor
      if (user) {
        setUser({ ...user, name: editName.trim() });
      }
      setShowEditModal(false);
      Alert.alert('Başarılı', 'Profil güncellendi');
    } catch (error) {
      Alert.alert('Hata', 'Profil güncellenemedi');
    }
    setLoading(false);
  };

  const handleNotificationPress = async (notif: any) => {
    // If it's a game invite, accept it and join
    if (notif.type === 'game_invite' && notif.data?.action === 'join_group_and_game') {
      Alert.alert(
        'Oyun Daveti',
        'Bu daveti kabul edip oyuna katılmak ister misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Katıl',
            onPress: async () => {
              setLoading(true);
              try {
                const token = await AsyncStorage.getItem('session_token');
                if (!token) return;
                
                const response = await fetch(`${API_URL}/api/notifications/${notif.notification_id}/accept-invite`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                  const data = await response.json();
                  Alert.alert('Başarılı', 'Gruba ve oyuna katıldınız!');
                  router.push(`/game/${data.game_id}`);
                } else {
                  const error = await response.json();
                  Alert.alert('Hata', error.detail || 'Katılım başarısız');
                }
              } catch (error) {
                Alert.alert('Hata', 'Bir hata oluştu');
              }
              setLoading(false);
            }
          }
        ]
      );
    } else if (notif.type === 'game_started' && notif.data?.game_id) {
      // If already in group, go to game
      router.push(`/game/${notif.data.game_id}`);
    } else if (notif.data?.game_id) {
      router.push(`/game/${notif.data.game_id}`);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={styles.gradient}
      >
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
          <LinearGradient
            colors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
            <TouchableOpacity 
              style={styles.editIconButton}
              onPress={() => {
                setEditName(user?.name || '');
                setShowEditModal(true);
              }}
            >
              <Ionicons name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            
            <View style={styles.playerIdBadge}>
              <Text style={styles.playerIdIcon}>🎯</Text>
              <Text style={styles.playerIdText}>{user?.player_id}</Text>
            </View>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <LinearGradient
              colors={[COLORS.card, COLORS.cardLight]}
              style={styles.statCard}
            >
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statValue}>{user?.weekly_score || 0}</Text>
              <Text style={styles.statLabel}>Haftalık Puan</Text>
            </LinearGradient>
            <LinearGradient
              colors={[COLORS.card, COLORS.cardLight]}
              style={styles.statCard}
            >
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statValue}>{user?.total_score || 0}</Text>
              <Text style={styles.statLabel}>Toplam Puan</Text>
            </LinearGradient>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bildirimler</Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={markAllNotificationsRead}>
                  <Text style={styles.markAllRead}>Tümünü Okundu İşaretle</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {notifications.length === 0 ? (
              <EmptyState
                icon="notifications-outline"
                title="Bildirim yok"
                message="Yeni bildirimler burada görünecek."
              />
            ) : (
              notifications.slice(0, 5).map((notif) => (
                <TouchableOpacity 
                  key={notif.notification_id} 
                  style={[
                    styles.notificationItem,
                    !notif.read && styles.notificationUnread
                  ]}
                  onPress={() => handleNotificationPress(notif)}
                >
                  <LinearGradient
                    colors={[getNotificationColor(notif.type) + '30', getNotificationColor(notif.type) + '10']}
                    style={styles.notificationIcon}
                  >
                    <Text style={styles.notificationEmoji}>{getNotificationEmoji(notif.type)}</Text>
                  </LinearGradient>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{notif.title}</Text>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notif.message}
                    </Text>
                  </View>
                  {!notif.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Settings Menu */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ayarlar</Text>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setEditName(user?.name || '');
                setShowEditModal(true);
              }}
            >
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.1)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuEmoji}>👤</Text>
              </LinearGradient>
              <Text style={styles.menuText}>Profili Düzenle</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem}>
              <LinearGradient
                colors={['rgba(34, 211, 238, 0.2)', 'rgba(34, 211, 238, 0.1)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuEmoji}>🔔</Text>
              </LinearGradient>
              <Text style={styles.menuText}>Bildirim Ayarları</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(251, 191, 36, 0.1)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuEmoji}>❓</Text>
              </LinearGradient>
              <Text style={styles.menuText}>Yardım & Destek</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem}>
              <LinearGradient
                colors={['rgba(244, 114, 182, 0.2)', 'rgba(244, 114, 182, 0.1)']}
                style={styles.menuIcon}
              >
                <Text style={styles.menuEmoji}>📄</Text>
              </LinearGradient>
              <Text style={styles.menuText}>Kullanım Şartları</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <View style={styles.section}>
            <TouchableOpacity onPress={handleLogout}>
              <LinearGradient
                colors={['#EF4444', '#F87171']}
                style={styles.logoutButton}
              >
                <Ionicons name="log-out-outline" size={22} color="#fff" />
                <Text style={styles.logoutText}>Çıkış Yap</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>

      {/* Edit Profile Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={[COLORS.backgroundLight, COLORS.card]}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profili Düzenle</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Input
              label="İsim"
              value={editName}
              onChangeText={setEditName}
              placeholder="İsminizi girin"
              icon="person-outline"
            />

            <View style={{ marginTop: 14 }}>
              <Button
                title={loading ? 'Kaydediliyor...' : 'Kaydet'}
                onPress={handleEditProfile}
                loading={loading}
                fullWidth
              />
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </View>
  );
}

function getNotificationEmoji(type: string): string {
  switch (type) {
    case 'friend_request': return '👤';
    case 'game_invite': return '🎮';
    case 'vote_needed': return '✋';
    case 'game_started': return '▶️';
    default: return '🔔';
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case 'friend_request': return '#EC4899';
    case 'game_invite': return '#8B5CF6';
    case 'vote_needed': return '#F59E0B';
    case 'game_started': return '#10B981';
    default: return '#8B5CF6';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    position: 'relative',
  },
  editIconButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  playerIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  playerIdIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  playerIdText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  markAllRead: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notificationUnread: {
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: 'rgba(99,102,241,0.45)',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationEmoji: {
    fontSize: 22,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 14,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  notificationMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuEmoji: {
    fontSize: 20,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 14,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});
