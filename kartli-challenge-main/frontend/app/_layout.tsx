import React, { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform, Linking } from 'react-native';
import { useAuthStore, useGameStore } from '../src/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

import { COLORS } from '../src/theme';

// Keep the splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated, isLoading, checkAuth, exchangeSession } = useAuthStore();
  const { joinGroup } = useGameStore();
  const router = useRouter();
  const segments = useSegments();
  const [processingAuth, setProcessingAuth] = useState(false);

  const tryConsumePendingInvite = useCallback(async () => {
    try {
      const pending = await AsyncStorage.getItem('pending_group_invite');
      if (!pending) return;

      const parsed = JSON.parse(pending);
      const code = parsed?.code;
      const ref = parsed?.ref;
      if (!code) {
        await AsyncStorage.removeItem('pending_group_invite');
        return;
      }

      const ok = await joinGroup(String(code), ref ? String(ref) : undefined);
      await AsyncStorage.removeItem('pending_group_invite');

      if (ok) {
        router.replace('/(tabs)/groups');
      }
    } catch {
      // ignore
    }
  }, [joinGroup, router]);

  // Load fonts
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle session_id from URL (for web)
  useEffect(() => {
    const processSessionFromURL = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const search = window.location.search;
        
        let sessionId = null;
        
        if (hash.includes('session_id=')) {
          sessionId = hash.split('session_id=')[1]?.split('&')[0];
        } else if (search.includes('session_id=')) {
          sessionId = search.split('session_id=')[1]?.split('&')[0];
        }
        
        if (sessionId && !processingAuth) {
          setProcessingAuth(true);
          // Clear URL
          window.history.replaceState({}, document.title, window.location.pathname);
          await exchangeSession(sessionId);
          setProcessingAuth(false);
        }
      }
    };

    processSessionFromURL();
  }, [exchangeSession, processingAuth]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle deep link for mobile
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      if (processingAuth) return;
      
      let sessionId = null;
      if (url.includes('session_id=')) {
        sessionId = url.split('session_id=')[1]?.split('&')[0];
      }

      // Group invite deep link: frontend://join?code=XXXX&ref=PLR123
      if (url.includes('code=')) {
        try {
          const u = new URL(url);
          const code = u.searchParams.get('code');
          const ref = u.searchParams.get('ref');
          if (code) {
            await AsyncStorage.setItem('pending_group_invite', JSON.stringify({ code, ref }));
            if (isAuthenticated) {
              await tryConsumePendingInvite();
            }
          }
        } catch {
          // ignore
        }
      }
      
      if (sessionId) {
        setProcessingAuth(true);
        await exchangeSession(sessionId);
        setProcessingAuth(false);
      }
    };

    // Cold start
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink(url);
    });

    // Hot link
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [exchangeSession, processingAuth, isAuthenticated, tryConsumePendingInvite]);

  useEffect(() => {
    if (isAuthenticated) {
      tryConsumePendingInvite();
    }
  }, [isAuthenticated, tryConsumePendingInvite]);

  // Route protection
  useEffect(() => {
    if (isLoading || processingAuth) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading, processingAuth, router]);

  if (isLoading || processingAuth || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="game/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
