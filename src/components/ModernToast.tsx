import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions, 
  TouchableOpacity,
  StatusBar 
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../theme/colors';

const { width } = Dimensions.get('window');

export interface ToastConfig {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
  onHide?: () => void;
}

interface ModernToastProps {
  config: ToastConfig;
  onHide: (id: string) => void;
}

const ModernToast: React.FC<ModernToastProps> = ({ config, onHide }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (isVisible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration (except for loading)
      if (config.type !== 'loading' && config.duration !== 0) {
        const timer = setTimeout(() => {
          hideToast();
        }, config.duration || 4000);

        return () => clearTimeout(timer);
      }
    }
  }, [isVisible]);

  const hideToast = () => {
    setIsVisible(false);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(config.id);
      config.onHide?.();
    });
  };

  const getToastStyle = () => {
    switch (config.type) {
      case 'success':
        return {
          backgroundColor: '#10B981',
          borderLeftColor: '#059669',
          iconColor: '#ffffff',
        };
      case 'error':
        return {
          backgroundColor: '#EF4444',
          borderLeftColor: '#DC2626',
          iconColor: '#ffffff',
        };
      case 'warning':
        return {
          backgroundColor: '#F59E0B',
          borderLeftColor: '#D97706',
          iconColor: '#ffffff',
        };
      case 'info':
        return {
          backgroundColor: '#3B82F6',
          borderLeftColor: '#2563EB',
          iconColor: '#ffffff',
        };
      case 'loading':
        return {
          backgroundColor: BrandColors.primary,
          borderLeftColor: BrandColors.secondary,
          iconColor: '#ffffff',
        };
      default:
        return {
          backgroundColor: '#6B7280',
          borderLeftColor: '#4B5563',
          iconColor: '#ffffff',
        };
    }
  };

  const getIcon = () => {
    switch (config.type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'loading':
        return 'hourglass-empty';
      default:
        return 'info';
    }
  };

  const toastStyle = getToastStyle();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: toastStyle.backgroundColor,
          borderLeftColor: toastStyle.borderLeftColor,
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={config.action ? config.action.onPress : hideToast}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Icon 
            name={getIcon()} 
            size={24} 
            color={toastStyle.iconColor}
            style={config.type === 'loading' ? styles.loadingIcon : undefined}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>{config.title}</Text>
          {config.message && (
            <Text style={styles.message}>{config.message}</Text>
          )}
        </View>

        {config.action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={config.action.onPress}
          >
            <Text style={styles.actionText}>{config.action.label}</Text>
          </TouchableOpacity>
        )}

        {config.type !== 'loading' && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={hideToast}
          >
            <Icon name="close" size={20} color={toastStyle.iconColor} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 50,
    left: 16,
    right: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 60,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
    transform: [{ rotate: '0deg' }],
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.9,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default ModernToast;
