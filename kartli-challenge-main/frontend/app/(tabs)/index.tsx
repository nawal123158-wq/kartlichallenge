import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore, useGameStore } from '../../src/store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user, notifications, fetchNotifications } = useAuthStore();
  const { groups, fetchGroups } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    await fetchGroups();
    setRefreshing(false);
  };

  const unreadNotifications = notifications.filter(n => !n.read);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundLight]}
        style={styles.gradient}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* Header */}
          <LinearGradient
            colors={['#8B5CF6', '#A78BFA', '#C4B5FD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.greeting}>Merhaba 👋</Text>
                <Text style={styles.userName}>{user?.name || 'Oyuncu'}</Text>
              </View>
              <TouchableOpacity 
                style={styles.notificationButton}
                onPress={() => router.push('/(tabs)/profile')}
              >
                <Ionicons name="notifications" size={24} color="#fff" />
                {unreadNotifications.length > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>⭐</Text>
                <Text style={styles.statValue}>{user?.weekly_score || 0}</Text>
                <Text style={styles.statLabel}>Haftalık</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>🏆</Text>
                <Text style={styles.statValue}>{user?.total_score || 0}</Text>
                <Text style={styles.statLabel}>Toplam</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>👥</Text>
                <Text style={styles.statValue}>{groups.length}</Text>
                <Text style={styles.statLabel}>Grup</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Player ID Card */}
          <View style={styles.section}>
            <LinearGradient
              colors={[COLORS.card, COLORS.cardLight]}
              style={styles.playerIdCard}
            >
              <View style={styles.playerIdContent}>
                <View style={styles.playerIdIconContainer}>
                  <Text style={styles.playerIdIcon}>🎯</Text>
                </View>
                <View style={styles.playerIdInfo}>
                  <Text style={styles.playerIdLabel}>{"Oyuncu ID'niz"}</Text>
                  <Text style={styles.playerId}>{user?.player_id || '...'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.copyButton}>
                <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </LinearGradient>
            <Text style={styles.playerIdHint}>
              Arkadaşlarınız bu ID ile sizi ekleyebilir
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/groups')}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#A78BFA']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>➕</Text>
                </LinearGradient>
                <Text style={styles.quickActionText}>Yeni Grup</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/friends')}
              >
                <LinearGradient
                  colors={['#F472B6', '#EC4899']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>👤</Text>
                </LinearGradient>
                <Text style={styles.quickActionText}>Arkadaş Ekle</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/groups')}
              >
                <LinearGradient
                  colors={['#22D3EE', '#06B6D4']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>🚪</Text>
                </LinearGradient>
                <Text style={styles.quickActionText}>Gruba Katıl</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickAction}
                onPress={() => router.push('/(tabs)/leaderboard')}
              >
                <LinearGradient
                  colors={['#FBBF24', '#F59E0B']}
                  style={styles.quickActionGradient}
                >
                  <Text style={styles.quickActionEmoji}>🏆</Text>
                </LinearGradient>
                <Text style={styles.quickActionText}>Sıralama</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Notifications */}
          {unreadNotifications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Son Bildirimler</Text>
              {unreadNotifications.slice(0, 3).map((notif) => (
                <TouchableOpacity 
                  key={notif.notification_id} 
                  style={styles.notificationItem}
                  onPress={() => {
                    if (notif.data?.game_id) {
                      router.push(`/game/${notif.data.game_id}`);
                    }
                  }}
                >
                  <LinearGradient
                    colors={[getNotificationColor(notif.type) + '30', getNotificationColor(notif.type) + '10']}
                    style={styles.notificationIcon}
                  >
                    <Text style={styles.notificationEmoji}>{getNotificationEmoji(notif.type)}</Text>
                  </LinearGradient>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{notif.title}</Text>
                    <Text style={styles.notificationMessage}>{notif.message}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Groups Preview */}
          {groups.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Gruplarınız</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
                  <Text style={styles.seeAll}>Tümünü Gör</Text>
                </TouchableOpacity>
              </View>
              {groups.slice(0, 3).map((group) => (
                <TouchableOpacity 
                  key={group.group_id} 
                  style={styles.groupItem}
                  onPress={() => router.push('/(tabs)/groups')}
                >
                  <LinearGradient
                    colors={[COLORS.cardLight, COLORS.card]}
                    style={styles.groupIcon}
                  >
                    <Text style={styles.groupEmoji}>👥</Text>
                  </LinearGradient>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupMembers}>{group.member_count || 0} üye</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🎮</Text>
              <Text style={styles.emptyTitle}>Henüz grubunuz yok</Text>
              <Text style={styles.emptyMessage}>
                Yeni bir grup oluşturun veya arkadaşlarınızın grubuna katılın
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/groups')}>
                <LinearGradient
                  colors={['#8B5CF6', '#A78BFA']}
                  style={styles.emptyButton}
                >
                  <Text style={styles.emptyButtonText}>Grup Oluştur</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </LinearGradient>
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
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 25,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 18,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 10,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  playerIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  playerIdContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerIdIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIdIcon: {
    fontSize: 24,
  },
  playerIdInfo: {
    marginLeft: 14,
  },
  playerIdLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  playerId: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
  },
  copyButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerIdHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: '22%',
  },
  quickActionGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickActionEmoji: {
    fontSize: 26,
  },
  quickActionText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
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
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  groupIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmoji: {
    fontSize: 24,
  },
  groupInfo: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  groupMembers: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
