import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ToastColors } from '../theme/colors';
import { useAppTheme } from '../app/providers/ThemeProvider';
import type { ToastConfig, ToastType } from '../core/toast';

export type { ToastConfig } from '../core/toast';

interface ModernToastProps {
  config: ToastConfig;
  onHide: (id: string) => void;
}

const ICONS: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
  loading: 'hourglass-empty',
};

const ENTER_MS = 250;
const EXIT_MS = 200;
const SWIPE_DISMISS_DY = -20;

/** Renders one toast (DESIGN_SYSTEM 5.16). Mounted only by NotificationManager. */
const ModernToast: React.FC<ModernToastProps> = ({ config, onHide }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hiding = useRef(false);

  const palette = theme.mode === 'dark' ? ToastColors.dark : ToastColors.light;
  const toneColor = ToastColors.tone[config.type];
  const { id, title, message, duration, type, action } = config;
  const label = message ? `${title}. ${message}` : title;

  const hide = useCallback(() => {
    if (hiding.current) return;
    hiding.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        easing: Easing.bezier(0.3, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -8,
        duration: EXIT_MS,
        easing: Easing.bezier(0.3, 0, 1, 1),
        useNativeDriver: true,
      }),
    ]).start(() => onHide(id)); // the store runs config.onHide when it removes the toast
  }, [id, onHide, opacity, translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_MS,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_MS,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // Announce only (no accessibilityLiveRegion), so Android does not read it twice.
    AccessibilityInfo.announceForAccessibility(label);

    if (duration > 0) {
      const timer = setTimeout(hide, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, hide, label, opacity, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy < 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy < SWIPE_DISMISS_DY) {
            hide();
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [hide, translateY],
  );

  const isLoading = type === 'loading';

  return (
    <Animated.View
      {...panResponder.panHandlers}
      testID="toast"
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: palette.background,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Plain row: the message and the action are separate accessibility elements. */}
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.body}
          onPress={isLoading ? undefined : hide}
          disabled={isLoading}
          activeOpacity={0.8}
          accessible
          accessibilityRole={isLoading ? 'text' : 'button'}
          accessibilityLabel={label}
          accessibilityHint={isLoading ? undefined : 'Double tap to dismiss'}
        >
          <Icon name={ICONS[type]} size={20} color={toneColor} style={styles.icon} />
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
              {title}
            </Text>
            {message ? (
              <Text style={[styles.message, { color: palette.text }]} numberOfLines={2}>
                {message}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {action ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              action.onPress();
              hide();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    shadowColor: ToastColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    color: ToastColors.action,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ModernToast;
