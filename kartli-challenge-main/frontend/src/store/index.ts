import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Game, Group, Friend, Notification, FriendRequest } from '../types';

import { API_URL } from '../config';

interface AuthState {
  user: User | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  setUser: (user: User | null) => void;
  setSessionToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<boolean>;
  exchangeSession: (sessionId: string) => Promise<User | null>;
  logout: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  sessionToken: null,
  isLoading: true,
  isAuthenticated: false,
  notifications: [],
  unreadCount: 0,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSessionToken: (sessionToken) => set({ sessionToken }),
  setLoading: (isLoading) => set({ isLoading }),

  checkAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return false;
      }

      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const user = await response.json();
        set({ user, sessionToken: token, isAuthenticated: true, isLoading: false });
        return true;
      } else {
        await AsyncStorage.removeItem('session_token');
        set({ isLoading: false, isAuthenticated: false, user: null, sessionToken: null });
        return false;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ isLoading: false, isAuthenticated: false });
      return false;
    }
  },

  exchangeSession: async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (response.ok) {
        const data = await response.json();
        await AsyncStorage.setItem('session_token', data.session_token);
        set({ 
          user: data.user, 
          sessionToken: data.session_token, 
          isAuthenticated: true,
          isLoading: false 
        });
        return data.user;
      }
      return null;
    } catch (error) {
      console.error('Session exchange error:', error);
      return null;
    }
  },

  logout: async () => {
    try {
      const token = get().sessionToken;
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      set({ user: null, sessionToken: null, isAuthenticated: false });
    }
  },

  fetchNotifications: async () => {
    try {
      const token = get().sessionToken;
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const notifications = await response.json();
        const unreadCount = notifications.filter((n: Notification) => !n.read).length;
        set({ notifications, unreadCount });
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  },

  markNotificationRead: async (notificationId: string) => {
    try {
      const token = get().sessionToken;
      if (!token) return;

      await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const notifications = get().notifications.map(n => 
        n.notification_id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read).length;
      set({ notifications, unreadCount });
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  },

  markAllNotificationsRead: async () => {
    try {
      const token = get().sessionToken;
      if (!token) return;

      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const notifications = get().notifications.map(n => ({ ...n, read: true }));
      set({ notifications, unreadCount: 0 });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
    }
  }
}));

// Game Store
interface GameState {
  currentGame: Game | null;
  games: Game[];
  groups: Group[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  
  // Actions
  setCurrentGame: (game: Game | null) => void;
  fetchGroups: () => Promise<void>;
  fetchFriends: () => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  createGroup: (name: string) => Promise<Group | null>;
  joinGroup: (inviteCode: string, referrerPlayerId?: string | null) => Promise<boolean>;
  createGame: (groupId: string) => Promise<Game | null>;
  joinGame: (gameId: string) => Promise<boolean>;
  startGame: (gameId: string) => Promise<boolean>;
  sendFriendRequest: (playerId: string) => Promise<boolean>;
  acceptFriendRequest: (requestId: string) => Promise<boolean>;
  rejectFriendRequest: (requestId: string) => Promise<boolean>;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentGame: null,
  games: [],
  groups: [],
  friends: [],
  friendRequests: [],

  setCurrentGame: (currentGame) => set({ currentGame }),

  fetchGroups: async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/groups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const groups = await response.json();
        set({ groups });
      }
    } catch (error) {
      console.error('Fetch groups error:', error);
    }
  },

  fetchFriends: async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const friends = await response.json();
        set({ friends });
      }
    } catch (error) {
      console.error('Fetch friends error:', error);
    }
  },

  fetchFriendRequests: async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/friends/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const friendRequests = await response.json();
        set({ friendRequests });
      }
    } catch (error) {
      console.error('Fetch friend requests error:', error);
    }
  },

  createGroup: async (name: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return null;

      const response = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (response.ok) {
        const data = await response.json();
        await get().fetchGroups();
        return data.group;
      }
      return null;
    } catch (error) {
      console.error('Create group error:', error);
      return null;
    }
  },

  joinGroup: async (inviteCode: string, referrerPlayerId?: string | null) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/groups/join`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invite_code: inviteCode, referrer_player_id: referrerPlayerId || undefined })
      });

      if (response.ok) {
        await get().fetchGroups();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Join group error:', error);
      return false;
    }
  },

  createGame: async (groupId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return null;

      const response = await fetch(`${API_URL}/api/games`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group_id: groupId })
      });

      if (response.ok) {
        const game = await response.json();
        set({ currentGame: game });
        return game;
      }
      return null;
    } catch (error) {
      console.error('Create game error:', error);
      return null;
    }
  },

  joinGame: async (gameId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/games/${gameId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      return response.ok;
    } catch (error) {
      console.error('Join game error:', error);
      return false;
    }
  },

  startGame: async (gameId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/games/${gameId}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      return response.ok;
    } catch (error) {
      console.error('Start game error:', error);
      return false;
    }
  },

  sendFriendRequest: async (playerId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/friends/request`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ player_id: playerId })
      });

      return response.ok;
    } catch (error) {
      console.error('Send friend request error:', error);
      return false;
    }
  },

  acceptFriendRequest: async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await get().fetchFriendRequests();
        await get().fetchFriends();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Accept friend request error:', error);
      return false;
    }
  },

  rejectFriendRequest: async (requestId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return false;

      const response = await fetch(`${API_URL}/api/friends/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await get().fetchFriendRequests();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Reject friend request error:', error);
      return false;
    }
  }
}));
