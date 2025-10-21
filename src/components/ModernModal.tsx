import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Modal,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

export interface ModernModalConfig {
  visible: boolean;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  message?: string;
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  onClose?: () => void;
  showCloseButton?: boolean;
  animationType?: 'fade' | 'slide' | 'scale';
}

interface ModernModalProps {
  config: ModernModalConfig;
  onClose: () => void;
}

const ModernModal: React.FC<ModernModalProps> = ({ config, onClose }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (config.visible) {
      // Show animation
      const animationType = config.animationType || 'scale';
      
      if (animationType === 'scale') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } else {
      // Hide animation
      const animationType = config.animationType || 'scale';
      
      if (animationType === 'scale') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else if (animationType === 'slide') {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [config.visible]);

  const handleClose = () => {
    onClose();
    config.onClose?.();
  };

  const getModalStyle = () => {
    switch (config.type) {
      case 'success':
        return {
          iconColor: '#10B981',
          primaryColor: '#10B981',
          backgroundColor: '#ffffff',
        };
      case 'error':
        return {
          iconColor: '#EF4444',
          primaryColor: '#EF4444',
          backgroundColor: '#ffffff',
        };
      case 'warning':
        return {
          iconColor: '#F59E0B',
          primaryColor: '#F59E0B',
          backgroundColor: '#ffffff',
        };
      case 'info':
        return {
          iconColor: '#3B82F6',
          primaryColor: '#3B82F6',
          backgroundColor: '#ffffff',
        };
      case 'loading':
        return {
          iconColor: BrandColors.primary,
          primaryColor: BrandColors.primary,
          backgroundColor: '#ffffff',
        };
      default:
        return {
          iconColor: '#6B7280',
          primaryColor: '#6B7280',
          backgroundColor: '#ffffff',
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

  const modalStyle = getModalStyle();
  const animationType = config.animationType || 'scale';

  return (
    <Modal
      visible={config.visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={config.showCloseButton !== false ? handleClose : undefined}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: modalStyle.backgroundColor,
              transform: [
                animationType === 'scale' 
                  ? { scale: scaleAnim }
                  : { translateY: slideAnim }
              ],
            },
          ]}
        >
          <View style={styles.content}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: `${modalStyle.iconColor}15` }]}>
              <Icon 
                name={getIcon()} 
                size={48} 
                color={modalStyle.iconColor}
                style={config.type === 'loading' ? styles.loadingIcon : undefined}
              />
            </View>

            {/* Title */}
            <Text style={styles.title}>{config.title}</Text>

            {/* Message */}
            {config.message && (
              <Text style={styles.message}>{config.message}</Text>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              {config.secondaryAction && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={config.secondaryAction.onPress}
                >
                  <Text style={styles.secondaryButtonText}>
                    {config.secondaryAction.label}
                  </Text>
                </TouchableOpacity>
              )}

              {config.primaryAction && (
                <TouchableOpacity
                  style={[styles.button, styles.primaryButton, { backgroundColor: modalStyle.primaryColor }]}
                  onPress={config.primaryAction.onPress}
                >
                  <Text style={styles.primaryButtonText}>
                    {config.primaryAction.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Close Button */}
            {config.showCloseButton !== false && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Icon name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  content: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loadingIcon: {
    transform: [{ rotate: '0deg' }],
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  message: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
});

export default ModernModal;
