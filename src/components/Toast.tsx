import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useAppTheme } from '../app/providers/ThemeProvider';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

// Global toast state
let toastState: {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  onHide?: () => void;
} = {
  visible: false,
  message: '',
  type: 'info',
};

let toastListeners: Array<() => void> = [];

const notifyListeners = () => {
  toastListeners.forEach(listener => listener());
};

// Static methods for showing toast
export const showToast = (type: 'success' | 'error' | 'info', message: string, onHide?: () => void) => {
  toastState = {
    visible: true,
    message,
    type,
    onHide,
  };
  notifyListeners();
};

export const hideToast = () => {
  toastState.visible = false;
  notifyListeners();
};

export default function Toast({ 
  message, 
  type, 
  visible, 
  onHide, 
  duration = 3000 
}: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Show toast
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Hide toast after duration
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToastLocal = () => {
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
    ]).start(() => {
      onHide();
    });
  };

  if (!visible) return null;

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#4CAF50', borderLeftColor: '#2E7D32' };
      case 'error':
        return { backgroundColor: '#F44336', borderLeftColor: '#C62828' };
      case 'info':
        return { backgroundColor: '#2196F3', borderLeftColor: '#1565C0' };
      default:
        return { backgroundColor: '#757575', borderLeftColor: '#424242' };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        getToastStyle(),
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={styles.icon}>{getIcon()}</Text>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
  },
  icon: {
    fontSize: 20,
    color: 'white',
    marginRight: 12,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});
