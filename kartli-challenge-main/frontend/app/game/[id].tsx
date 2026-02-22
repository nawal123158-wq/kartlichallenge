import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/store';
import { EmptyState, GameCard, Button, Input, Skeleton } from '../../src/components/UI';
import { Game, Card, HandCard, Submission, ChatMessage, GamePlayer } from '../../src/types';
import { API_URL } from '../../src/config';

import { COLORS } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GameScreen() {
  const { id: gameId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [game, setGame] = useState<Game | null>(null);
  const [myCards, setMyCards] = useState<HandCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<HandCard | null>(null);
  const [passUsed, setPassUsed] = useState(false);
  const [swapUsed, setSwapUsed] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Modals
  const [showPlayModal, setShowPlayModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // Play state
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  const getToken = async () => {
    return await AsyncStorage.getItem('session_token');
  };

  const fetchGame = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setGame(data);
      } else if (response.status === 404) {
        Alert.alert('Hata', 'Oyun bulunamadı');
        router.back();
      }
    } catch (error) {
      console.error('Fetch game error:', error);
    }
  };

  const fetchMyCards = async () => {
    try {
      const token = await getToken();
      if (!token || !game || game.status !== 'started') return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/my-cards`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMyCards(data.cards || []);
        setPassUsed(data.pass_used);
        setSwapUsed(data.swap_used);
      }
    } catch (error) {
      console.error('Fetch cards error:', error);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const token = await getToken();
      if (!token || !game || game.status !== 'started') return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error('Fetch submissions error:', error);
    }
  };

  const fetchChat = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(data);
      }
    } catch (error) {
      console.error('Fetch chat error:', error);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await fetchGame();
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, [gameId]);

  useEffect(() => {
    if (game) {
      fetchMyCards();
      fetchSubmissions();
      fetchChat();
    }
  }, [game]);

  // Refresh periodically when game is in waiting or ready state
  useEffect(() => {
    const interval = setInterval(() => {
      if (game?.status === 'waiting' || game?.status === 'ready') {
        fetchGame();
      } else if (game?.status === 'started') {
        fetchGame();
        fetchSubmissions();
        fetchChat();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [game]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGame();
    await fetchMyCards();
    await fetchSubmissions();
    await fetchChat();
    setRefreshing(false);
  };

  const handleJoinGame = async () => {
    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        Alert.alert('Başarılı', 'Oyuna katıldınız!');
        // Start 3 second countdown
        setCountdown(3);
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownInterval);
              fetchGame(); // Refresh after countdown
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        const error = await response.json();
        Alert.alert('Hata', error.detail || 'Katılım başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
    setActionLoading(false);
  };

  const handleStartGame = async () => {
    if (!game || game.players!.length < 2) {
      Alert.alert('Hata', 'En az 2 oyuncu gerekli!');
      return;
    }

    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        Alert.alert('Başarılı', 'Oyun başladı!');
        await fetchGame();
        await fetchMyCards();
      } else {
        const error = await response.json();
        Alert.alert('Hata', error.detail || 'Oyun başlatılamadı');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
    setActionLoading(false);
  };

  const handleSelectCard = (card: HandCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    // prevent selecting if it's not this player's turn
    const currentPlayerId = game?.turn_order?.[game?.current_turn_index ?? 0];
    if (currentPlayerId && currentPlayerId !== user?.user_id) {
      Alert.alert('Sıra değil', 'Şu an sizin sıranız değil.');
      return;
    }

    setSelectedCard(card);
    setProofPhoto(null);
    setProofNote('');
    setShowPlayModal(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Galeri erişimi için izin verin');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setProofPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Kamera erişimi için izin verin');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setProofPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handlePlayCard = async (action: 'play' | 'pass' | 'refuse') => {
    if (!selectedCard) return;

    if (action === 'play' && !proofPhoto) {
      Alert.alert('Kanıt gerekli', 'Lütfen fotoğraf ekleyin');
      return;
    }

    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/play`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          card_id: selectedCard.card.card_id,
          action,
          photo_base64: action === 'play' ? proofPhoto : null,
          note: action === 'play' ? proofNote : null,
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowPlayModal(false);
        setSelectedCard(null);
        setProofPhoto(null);
        setProofNote('');
        
        if (action === 'refuse' && data.penalty_card) {
          Alert.alert('Ceza Kartı!', `${data.penalty_card.title}: ${data.penalty_card.description}`);
        } else if (action === 'play') {
          Alert.alert('Başarılı', 'Kanıt gönderildi! Oylamanı bekle.');
        } else {
          Alert.alert('Pas', 'Bu turu pas geçtiniz.');
        }
        
        await fetchMyCards();
        await fetchSubmissions();
        await fetchChat();
      } else {
        const error = await response.json();
        Alert.alert('Hata', error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
    setActionLoading(false);
  };

  const handleSwapCard = async () => {
    if (!selectedCard || swapUsed) return;

    Alert.alert(
      'Kart Değiştir',
      'Bu kartı değiştirmek istediğinize emin misiniz? (1 hak)',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Değiştir',
          onPress: async () => {
            setActionLoading(true);
            try {
              const token = await getToken();
              if (!token) return;

              const response = await fetch(`${API_URL}/api/games/${gameId}/swap`, {
                method: 'POST',
                headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ card_id: selectedCard.card.card_id })
              });

              if (response.ok) {
                const data = await response.json();
                Alert.alert('Kart Değişti!', `Yeni kart: ${data.new_card?.title || 'Bilinmiyor'}`);
                setShowPlayModal(false);
                setSelectedCard(null);
                await fetchMyCards();
              } else {
                const error = await response.json();
                Alert.alert('Hata', error.detail || 'Değiştirme başarısız');
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu');
            }
            setActionLoading(false);
          }
        }
      ]
    );
  };

  const handleVote = async (voteType: 'approve' | 'reject') => {
    if (!selectedSubmission) return;

    setActionLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/submissions/${selectedSubmission.submission_id}/vote`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote_type: voteType })
      });

      if (response.ok) {
        const data = await response.json();
        setShowVoteModal(false);
        setSelectedSubmission(null);
        
        if (data.result === 'approved') {
          Alert.alert('Onaylandı!', 'Görev kabul edildi');
        } else if (data.result === 'rejected') {
          Alert.alert('Reddedildi!', 'Görev reddedildi, ceza verildi');
        } else {
          Alert.alert('Oylandı', 'Oyunuz kaydedildi');
        }
        
        await fetchSubmissions();
        await fetchChat();
      } else {
        const error = await response.json();
        Alert.alert('Hata', error.detail || 'Oy verilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
    setActionLoading(false);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/games/${gameId}/chat`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: chatMessage.trim() })
      });

      if (response.ok) {
        setChatMessage('');
        await fetchChat();
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const isCreator = game?.created_by === user?.user_id;
  const isPlayer = game?.players?.some(p => p.user_id === user?.user_id);
  const pendingVotes = submissions.filter(s => s.user_id !== user?.user_id && !s.my_vote);

  const currentPlayerId = game?.turn_order?.[game?.current_turn_index ?? 0] ?? null;
  const currentPlayer = game?.players?.find(p => p.user_id === currentPlayerId) || null;
  const isMyTurn = currentPlayerId === user?.user_id;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingHorizontal: 16, alignItems: 'stretch' }]}>
          <Skeleton height={44} radius={16} style={{ marginTop: 8 }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Skeleton height={84} width={84} radius={22} />
            <Skeleton height={84} width={84} radius={22} />
            <Skeleton height={84} width={84} radius={22} />
          </View>
          <Skeleton height={18} radius={10} style={{ marginTop: 18, width: '50%' }} />
          <Skeleton height={210} radius={18} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryLight]}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>
              {game?.status === 'waiting' ? 'Bekleme Odası' : `El ${game?.current_hand || 0}`}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
              {isMyTurn ? 'Sıra sizde' : `Sırada: ${currentPlayer?.name || '—'}`}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(game?.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(game?.status)}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowChatModal(true)} style={styles.chatButton}>
            <Ionicons name="chatbubbles" size={24} color="#fff" />
            {chatMessages.length > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>{chatMessages.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>

        {/* Players */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Oyuncular ({game?.players?.length || 0})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {game?.players?.map((player) => (
              <View key={player.user_id} style={styles.playerCard}>
                <View style={[
                  styles.playerAvatar,
                  player.user_id === user?.user_id && styles.playerAvatarMe,
                  player.user_id === currentPlayerId && styles.playerAvatarActive
                ]}>
                  <Text style={styles.playerAvatarText}>
                    {player.name?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {player.user_id === user?.user_id ? 'Sen' : player.name}
                </Text>
                <Text style={styles.playerScore}>{player.score} puan</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Waiting Room Actions */}
        {(game?.status === 'waiting' || game?.status === 'ready') && (
          <View style={styles.section}>
            {!isPlayer ? (
              <Button
                title="Oyuna Katıl"
                onPress={handleJoinGame}
                loading={actionLoading}
                icon="enter"
                fullWidth
              />
            ) : isCreator ? (
              <Button
                title={game.players!.length < 2 ? 'En az 2 oyuncu gerekli' : 'Oyunu Başlat'}
                onPress={handleStartGame}
                loading={actionLoading}
                disabled={game.players!.length < 2}
                icon="play"
                fullWidth
              />
            ) : (
              <View style={styles.waitingMessage}>
                <Ionicons name="time" size={32} color={COLORS.textMuted} />
                {countdown !== null ? (
                  <Text style={[styles.waitingText, { fontSize: 24, fontWeight: 'bold', color: COLORS.primary }]}>
                    {countdown} saniye içinde güncelleniyor...
                  </Text>
                ) : (
                  <Text style={styles.waitingText}>Oyun başlaması bekleniyor...</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* My Cards (Active Game) */}
        {game?.status === 'started' && isPlayer && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kartlarım</Text>
              <View style={styles.abilities}>
                <View style={[styles.abilityBadge, passUsed && styles.abilityUsed]}>
                  <Text style={styles.abilityText}>Pas {passUsed ? '(Kullanıldı)' : '(1)'}</Text>
                </View>
                <View style={[styles.abilityBadge, swapUsed && styles.abilityUsed]}>
                  <Text style={styles.abilityText}>Değiştir {swapUsed ? '(Kullanıldı)' : '(1)'}</Text>
                </View>
              </View>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll}>
              {myCards.map((hc) => (
                <View key={hc.hand_card_id} style={styles.cardWrapper}>
                  <GameCard
                    card={hc.card}
                    onPress={() => handleSelectCard(hc)}
                    size="medium"
                  />
                </View>
              ))}
              {myCards.length === 0 && (
                <View style={{ width: SCREEN_WIDTH - 32, paddingRight: 16 }}>
                  <EmptyState
                    icon="albums-outline"
                    title="Bu turda kartın kalmadı"
                    message="Bir sonraki el için bekle."
                  />
                </View>
              )}
            </ScrollView>
          </View>
        )}

        {/* Pending Votes */}
        {game?.status === 'started' && pendingVotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Oylama Bekleyen ({pendingVotes.length})</Text>
            {pendingVotes.map((sub) => (
              <TouchableOpacity
                key={sub.submission_id}
                style={styles.voteCard}
                onPress={() => {
                  setSelectedSubmission(sub);
                  setShowVoteModal(true);
                }}
              >
                <View style={styles.voteCardHeader}>
                  <Text style={styles.voteCardUser}>{sub.user?.name}</Text>
                  <View style={styles.voteCounts}>
                    <View style={styles.voteCount}>
                      <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                      <Text style={styles.voteCountText}>{sub.votes_approve}</Text>
                    </View>
                    <View style={styles.voteCount}>
                      <Ionicons name="close-circle" size={16} color={COLORS.error} />
                      <Text style={styles.voteCountText}>{sub.votes_reject}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.voteCardTitle}>{sub.card?.title}</Text>
                <Text style={styles.tapToVote}>Oy vermek için dokun</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Play Card Modal */}
      <Modal visible={showPlayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kart Oyna</Text>
              <TouchableOpacity onPress={() => setShowPlayModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedCard && (
              <>
                <View style={styles.selectedCardPreview}>
                  <GameCard card={selectedCard.card} size="small" />
                  <View style={styles.cardDetails}>
                    <Text style={styles.cardDetailTitle}>{selectedCard.card.title}</Text>
                    <Text style={styles.cardDetailDesc}>{selectedCard.card.description}</Text>
                  </View>
                </View>

                {/* Photo Proof */}
                <Text style={styles.inputLabel}>Kanıt Fotoğrafı</Text>
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={24} color={COLORS.primary} />
                    <Text style={styles.photoButtonText}>Çek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                    <Ionicons name="images" size={24} color={COLORS.primary} />
                    <Text style={styles.photoButtonText}>Galeri</Text>
                  </TouchableOpacity>
                </View>

                {proofPhoto && (
                  <Image source={{ uri: proofPhoto }} style={styles.proofPreview} />
                )}

                <View style={{ marginTop: 12 }}>
                  <Input
                    label="Not (Opsiyonel)"
                    value={proofNote}
                    onChangeText={setProofNote}
                    placeholder="Açıklama ekle..."
                    icon="document-text-outline"
                    multiline
                  />
                </View>

                {/* Actions */}
                <View style={styles.playActions}>
                  <Button
                    title="Yapıyorum"
                    onPress={() => handlePlayCard('play')}
                    loading={actionLoading}
                    icon="checkmark"
                    fullWidth
                  />
                  
                  <View style={styles.secondaryActions}>
                    {!passUsed && (
                      <TouchableOpacity 
                        style={styles.secondaryButton}
                        onPress={() => handlePlayCard('pass')}
                        disabled={actionLoading}
                      >
                        <Ionicons name="hand-left" size={20} color={COLORS.warning} />
                        <Text style={[styles.secondaryButtonText, { color: COLORS.warning }]}>Pas</Text>
                      </TouchableOpacity>
                    )}
                    
                    {!swapUsed && (
                      <TouchableOpacity 
                        style={styles.secondaryButton}
                        onPress={handleSwapCard}
                        disabled={actionLoading}
                      >
                        <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
                        <Text style={[styles.secondaryButtonText, { color: COLORS.primary }]}>Değiştir</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.secondaryButton}
                      onPress={() => handlePlayCard('refuse')}
                      disabled={actionLoading}
                    >
                      <Ionicons name="skull" size={20} color={COLORS.error} />
                      <Text style={[styles.secondaryButtonText, { color: COLORS.error }]}>Reddet (Ceza)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Vote Modal */}
      <Modal visible={showVoteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Oylama</Text>
              <TouchableOpacity onPress={() => setShowVoteModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {selectedSubmission && (
              <>
                <View style={styles.submissionInfo}>
                  <Text style={styles.submissionUser}>{selectedSubmission.user?.name}</Text>
                  <Text style={styles.submissionCard}>{selectedSubmission.card?.title}</Text>
                  <Text style={styles.submissionDesc}>{selectedSubmission.card?.description}</Text>
                </View>

                {selectedSubmission.photo_base64 && (
                  <Image 
                    source={{ uri: selectedSubmission.photo_base64 }} 
                    style={styles.submissionPhoto} 
                  />
                )}

                {selectedSubmission.note && (
                  <Text style={styles.submissionNote}>{`"${selectedSubmission.note}"`}</Text>
                )}

                <View style={styles.voteButtons}>
                  <TouchableOpacity
                    style={[styles.voteButton, styles.approveButton]}
                    onPress={() => handleVote('approve')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="checkmark-circle" size={32} color="#fff" />
                    <Text style={styles.voteButtonText}>Onayla</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.voteButton, styles.rejectButton]}
                    onPress={() => handleVote('reject')}
                    disabled={actionLoading}
                  >
                    <Ionicons name="close-circle" size={32} color="#fff" />
                    <Text style={styles.voteButtonText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Chat Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Oyun Sohbeti</Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.chatList}>
              {chatMessages.map((msg) => (
                <View 
                  key={msg.message_id} 
                  style={[
                    styles.chatMessage,
                    msg.user_id === user?.user_id && styles.chatMessageMe,
                    msg.message_type === 'system' && styles.chatMessageSystem
                  ]}
                >
                  {msg.message_type !== 'system' && (
                    <Text style={styles.chatUser}>{msg.user?.name || 'Sistem'}</Text>
                  )}
                  <Text style={[
                    styles.chatText,
                    msg.message_type === 'system' && styles.chatTextSystem
                  ]}>
                    {msg.content}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInput}
                value={chatMessage}
                onChangeText={setChatMessage}
                placeholder="Mesaj yaz..."
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStatusColor(status?: string): string {
  switch (status) {
    case 'waiting': return COLORS.warning;
    case 'ready': return COLORS.primaryLight;
    case 'started': return COLORS.success;
    case 'finished': return COLORS.textMuted;
    default: return COLORS.primary;
  }
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'waiting': return 'Bekleniyor';
    case 'ready': return 'Hazır';
    case 'started': return 'Aktif';
    case 'finished': return 'Bitti';
    default: return 'Bilinmiyor';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  abilities: {
    flexDirection: 'row',
    gap: 8,
  },
  abilityBadge: {
    backgroundColor: COLORS.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  abilityUsed: {
    opacity: 0.5,
  },
  abilityText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  playerCard: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  playerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  playerAvatarActive: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  playerAvatarMe: {
    backgroundColor: COLORS.primary,
  },
  playerAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  playerName: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
  },
  playerScore: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  waitingMessage: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  waitingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  cardsScroll: {
    marginTop: -12,
  },
  cardWrapper: {
    marginRight: 12,
  },
  noCardsText: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  voteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  voteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  voteCardUser: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  voteCounts: {
    flexDirection: 'row',
    gap: 12,
  },
  voteCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  voteCardTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tapToVote: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundLight,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  selectedCardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardDetails: {
    flex: 1,
    marginLeft: 16,
  },
  cardDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardDetailDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 8,
  },
  proofPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
  },
  noteInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  playActions: {
    marginTop: 20,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 20,
  },
  secondaryButton: {
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 11,
    marginTop: 4,
  },
  submissionInfo: {
    marginBottom: 16,
  },
  submissionUser: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  submissionCard: {
    fontSize: 16,
    color: COLORS.primary,
    marginTop: 4,
  },
  submissionDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  submissionPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  submissionNote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  voteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 16,
  },
  approveButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.error,
  },
  voteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },
  chatList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  chatMessage: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  chatMessageMe: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
  },
  chatMessageSystem: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    maxWidth: '100%',
  },
  chatUser: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  chatText: {
    fontSize: 14,
    color: COLORS.text,
  },
  chatTextSystem: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
