import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Card as CardType } from '../types';

import { COLORS } from '../theme';

export { COLORS };

// Card Component
interface CardProps {
  card: CardType;
  onPress?: () => void;
  selected?: boolean;
  showActions?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const GameCard: React.FC<CardProps> = ({ 
  card, 
  onPress, 
  selected = false,
  size = 'medium' 
}) => {
  const getDeckColor = (type: string): [string, string] => {
    switch (type) {
      case 'komik': return ['#F97316', '#FB923C'];
      case 'sosyal': return ['#06B6D4', '#22D3EE'];
      case 'beceri': return ['#8B5CF6', '#A78BFA'];
      case 'cevre': return ['#22C55E', '#4ADE80'];
      case 'ceza': return ['#EF4444', '#F87171'];
      default: return ['#6366F1', '#818CF8'];
    }
  };

  const getDeckIcon = (type: string): string => {
    switch (type) {
      case 'komik': return 'happy';
      case 'sosyal': return 'people';
      case 'beceri': return 'flash';
      case 'cevre': return 'home';
      case 'ceza': return 'skull';
      default: return 'card';
    }
  };

  const getDeckLabel = (type: string): string => {
    switch (type) {
      case 'komik': return 'Komik';
      case 'sosyal': return 'Sosyal';
      case 'beceri': return 'Beceri';
      case 'cevre': return 'Çevre';
      case 'ceza': return 'Ceza';
      default: return type;
    }
  };

  const sizeStyles = {
    small: { width: 100, height: 140, padding: 8 },
    medium: { width: 140, height: 200, padding: 12 },
    large: { width: 180, height: 260, padding: 16 },
  };

  const currentSize = sizeStyles[size];

  return (
    <TouchableOpacity 
      onPress={onPress} 
      activeOpacity={0.8}
      style={[
        styles.cardContainer,
        { width: currentSize.width, height: currentSize.height },
        selected && styles.cardSelected
      ]}
    >
      <LinearGradient
        colors={getDeckColor(card.deck_type)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardGradient, { padding: currentSize.padding }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.deckBadge}>
            <Ionicons name={getDeckIcon(card.deck_type) as any} size={14} color="#fff" />
            <Text style={styles.deckLabel}>{getDeckLabel(card.deck_type)}</Text>
          </View>
          {card.points > 0 && (
            <View style={styles.pointsBadge}>
              <Text style={styles.pointsText}>+{card.points}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>{card.title}</Text>
          <Text style={styles.cardDescription} numberOfLines={size === 'small' ? 2 : 4}>
            {card.description}
          </Text>
        </View>
        
        {card.time_limit && (
          <View style={styles.timerBadge}>
            <Ionicons name="time" size={12} color="#fff" />
            <Text style={styles.timerText}>{card.time_limit}s</Text>
          </View>
        )}
        
        <View style={styles.difficultyContainer}>
          {[...Array(3)].map((_, i) => (
            <Ionicons 
              key={i}
              name="star" 
              size={12} 
              color={i < card.difficulty ? '#FFD700' : 'rgba(255,255,255,0.3)'} 
            />
          ))}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Button Component
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: [COLORS.primary, COLORS.primaryLight] as [string, string],
          text: '#fff',
        };
      case 'secondary':
        return {
          bg: [COLORS.secondary, COLORS.secondaryLight] as [string, string],
          text: '#fff',
        };
      case 'outline':
        return {
          bg: ['transparent', 'transparent'] as [string, string],
          text: COLORS.primary,
          border: COLORS.primary,
        };
      case 'ghost':
        return {
          bg: ['transparent', 'transparent'] as [string, string],
          text: COLORS.text,
        };
      case 'danger':
        return {
          bg: [COLORS.error, '#F87171'] as [string, string],
          text: '#fff',
        };
      default:
        return {
          bg: [COLORS.primary, COLORS.primaryLight] as [string, string],
          text: '#fff',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 32, fontSize: 18 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 24, fontSize: 16 };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[fullWidth && { width: '100%' }]}
    >
      <LinearGradient
        colors={disabled ? ['#475569', '#475569'] : variantStyles.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.button,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
          variantStyles.border && { borderWidth: 2, borderColor: variantStyles.border },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.text} />
        ) : (
          <View style={styles.buttonContent}>
            {icon && (
              <Ionicons 
                name={icon as any} 
                size={sizeStyles.fontSize + 2} 
                color={disabled ? COLORS.textMuted : variantStyles.text} 
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              style={[
                styles.buttonText,
                { 
                  fontSize: sizeStyles.fontSize, 
                  color: disabled ? COLORS.textMuted : variantStyles.text 
                },
              ]}
            >
              {title}
            </Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Avatar Component
interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 40 }) => {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (uri) {
    return (
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarInitials, { fontSize: size / 2.5 }]}>{initials}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size / 2.5 }]}>{initials}</Text>
    </View>
  );
};

// Badge Component
interface BadgeProps {
  count: number;
  size?: number;
}

export const Badge: React.FC<BadgeProps> = ({ count, size = 18 }) => {
  if (count <= 0) return null;
  
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.6 }]}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
};

// Input Component
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  icon?: string;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  icon,
  multiline,
  numberOfLines,
}) => {
  return (
    <View style={styles.inputContainer}>
      {icon && (
        <Ionicons name={icon as any} size={20} color={COLORS.textMuted} style={styles.inputIcon} />
      )}
      <View style={[styles.input, multiline && { height: 100 }]}>
        <Text style={{ color: value ? COLORS.text : COLORS.textMuted }}>
          {value || placeholder}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Card styles
  cardContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: '#FFD700',
    transform: [{ scale: 1.05 }],
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deckLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  pointsBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    lineHeight: 16,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  timerText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 4,
  },
  difficultyContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
  },
  
  // Button styles
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  
  // Avatar styles
  avatar: {
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Badge styles
  badge: {
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: -4,
    right: -4,
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  // Input styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
  },
});
