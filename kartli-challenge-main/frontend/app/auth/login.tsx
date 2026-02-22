import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';

import { API_URL } from '../../src/config';

import { Button } from '../../src/components/UI';

import { COLORS, theme } from '../../src/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const handleGoogleLogin = async () => {
    let redirectUrl: string;
    
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        redirectUrl = window.location.origin + '/';
      } else {
        redirectUrl = `${API_URL}/`;
      }
    } else {
      redirectUrl = ExpoLinking.createURL('/');
    }
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      try {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        if (result.type === 'success' && result.url) {
          console.log('Auth redirect URL:', result.url);
        }
      } catch (error) {
        console.error('Auth error:', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0A0A1A', '#15152D', '#1A1A35', '#0A0A1A']}
        style={styles.gradient}
      >
        {/* Animated Background Elements */}
        <View style={styles.bgDecoration}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.3)', 'transparent']}
            style={[styles.bgCircle, { top: -100, left: -50 }]}
          />
          <LinearGradient
            colors={['rgba(244, 114, 182, 0.2)', 'transparent']}
            style={[styles.bgCircle, { top: 200, right: -80 }]}
          />
          <LinearGradient
            colors={['rgba(34, 211, 238, 0.15)', 'transparent']}
            style={[styles.bgCircle, { bottom: 100, left: -30 }]}
          />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#8B5CF6', '#F472B6', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoEmoji}>🎴</Text>
            </LinearGradient>
            <View style={styles.logoGlow} />
          </View>
          
          <Text style={styles.title}>Kartlı Challenge</Text>
          <Text style={styles.subtitle}>
            Arkadaşlarınla eğlenceli görevler yap{'\n'}kanıt paylaş, puan kazan!
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(251, 191, 36, 0.05)']}
                style={styles.featureIcon}
              >
                <Text style={styles.featureEmoji}>😂</Text>
              </LinearGradient>
              <Text style={styles.featureText}>Komik Görevler</Text>
            </View>
            <View style={styles.feature}>
              <LinearGradient
                colors={['rgba(34, 211, 238, 0.2)', 'rgba(34, 211, 238, 0.05)']}
                style={styles.featureIcon}
              >
                <Text style={styles.featureEmoji}>👥</Text>
              </LinearGradient>
              <Text style={styles.featureText}>Sosyal Etkinlik</Text>
            </View>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.feature}>
              <LinearGradient
                colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)']}
                style={styles.featureIcon}
              >
                <Text style={styles.featureEmoji}>⚡</Text>
              </LinearGradient>
              <Text style={styles.featureText}>Mini Beceriler</Text>
            </View>
            <View style={styles.feature}>
              <LinearGradient
                colors={['rgba(244, 114, 182, 0.2)', 'rgba(244, 114, 182, 0.05)']}
                style={styles.featureIcon}
              >
                <Text style={styles.featureEmoji}>🏆</Text>
              </LinearGradient>
              <Text style={styles.featureText}>Liderlik Tablosu</Text>
            </View>
          </View>
        </View>

        {/* Login Button */}
        <View style={styles.loginSection}>
          <Button
            title="Google ile Giriş Yap"
            onPress={handleGoogleLogin}
            icon="logo-google"
            fullWidth
            size="large"
          />
          
          <Text style={styles.disclaimer}>
            Giriş yaparak kullanım şartlarını kabul etmiş olursunuz
          </Text>
        </View>

        {/* Cards Preview */}
        <View style={styles.cardsPreview}>
          <View style={[styles.previewCard, styles.previewCard1]}>
            <LinearGradient
              colors={['#F97316', '#FBBF24']}
              style={styles.previewCardGradient}
            >
              <Text style={styles.cardEmoji}>😂</Text>
            </LinearGradient>
          </View>
          <View style={[styles.previewCard, styles.previewCard2]}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={styles.previewCardGradient}
            >
              <Text style={styles.cardEmoji}>⚡</Text>
            </LinearGradient>
          </View>
          <View style={[styles.previewCard, styles.previewCard3]}>
            <LinearGradient
              colors={['#06B6D4', '#22D3EE']}
              style={styles.previewCardGradient}
            >
              <Text style={styles.cardEmoji}>👥</Text>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'space-between',
  },
  bgDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgCircle: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
  },
  heroSection: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    top: -10,
    left: -10,
    zIndex: -1,
  },
  logoEmoji: {
    fontSize: 55,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: theme.fonts.display,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
    fontFamily: theme.fonts.body,
  },
  featuresSection: {
    paddingVertical: 24,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  feature: {
    alignItems: 'center',
    width: '42%',
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  featureEmoji: {
    fontSize: 30,
  },
  featureText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: theme.fonts.body,
  },
  loginSection: {
    alignItems: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 20,
    minWidth: 280,
  },
  googleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  cardsPreview: {
    height: 90,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  previewCard: {
    width: 55,
    height: 75,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewCard1: {
    transform: [{ rotate: '-20deg' }, { translateX: 25 }],
    zIndex: 1,
  },
  previewCard2: {
    transform: [{ rotate: '0deg' }, { scale: 1.1 }],
    zIndex: 3,
  },
  previewCard3: {
    transform: [{ rotate: '20deg' }, { translateX: -25 }],
    zIndex: 1,
  },
  previewCardGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 24,
  },
});
