import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { toast, toastStore, type ToastConfig, type ToastType } from '../../core/toast';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { t } from '../../i18n';
import { componentTokens, DarkTheme, layout, motionPatterns, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  config: ToastConfig;
  onHide: (id: string) => void;
  /** Kit gallery only: static, in the layout flow, no timer, no announcement. */
  preview?: boolean;
};

const ICONS: Record<Exclude<ToastType, 'loading'>, IconName> = {
  success: 'check',
  error: 'warning',
  warning: 'alertTriangle',
  info: 'info',
};

/**
 * Tone glyphs and the action use the dark-mode tokens in both modes: the toast is always an
 * inverse (dark) surface, where those values pass AA (§5.16: success `#4ACB7E`, error `#FF7A7F`,
 * info `#7FA8F5`, action navy-300).
 */
const inverse = DarkTheme.colors;
const toneColor: Record<ToastType, string> = {
  success: inverse.success,
  error: inverse.danger,
  warning: inverse.warning,
  info: inverse.info,
  loading: inverse.primaryText,
};

const m = motionPatterns.toast;
const toAnimatedEasing = (e: { x1: number; y1: number; x2: number; y2: number }) => Easing.bezier(e.x1, e.y1, e.x2, e.y2);
const ENTER_EASING = toAnimatedEasing({ x1: 0.2, y1: 0, x2: 0, y2: 1 });
const EXIT_EASING = toAnimatedEasing({ x1: 0.3, y1: 0, x2: 1, y2: 1 });

/**
 * Toast (DESIGN_SYSTEM §5.16, UI-R3 restyle): top-anchored 8 below the 56 Header bar
 * (`insets.top + 56 + 8`; T-540: never over the back button; `topOffset` overrides the 56), 16
 * from the sides, min height 48, radius 12; light mode `textPrimary` fill with `textInverse` text, dark
 * mode `surfaceRaised` with `textPrimary`; elevation 4. Leading 20 glyph tinted by tone, text
 * `bodySmall` ([UI-R3] title 2 lines, message 2), optional `buttonSmall` action in navy-300. In: −16→0 +
 * fade 250 ms; out: fade + −8 in 200 ms; reduced motion: fade only. Swipe up or tap to dismiss.
 * Rendered one at a time by NotificationManager from the queue in src/core/toast.
 */
export function ToastView({ config, onHide, preview = false }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const opacity = useRef(new Animated.Value(preview ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(preview || reduce ? 0 : m.in.translateY)).current;
  const hiding = useRef(false);

  const dark = theme.mode === 'dark';
  const fill = dark ? theme.colors.surfaceRaised : theme.colors.textPrimary;
  const textColor = dark ? theme.colors.textPrimary : theme.colors.textInverse;
  const { id, title, message, duration, type, action, topOffset = componentTokens.header.barHeight } = config;
  // One separator between the lines, never "..": a title may already end its sentence.
  const label = message ? `${title}${/[.!?]$/.test(title) ? '' : '.'} ${message}` : title;

  const hide = useCallback(() => {
    if (hiding.current) return;
    hiding.current = true;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: m.out.duration, easing: EXIT_EASING, useNativeDriver: true }),
      Animated.timing(translateY, {
        toValue: reduce ? 0 : m.out.translateY,
        duration: m.out.duration,
        easing: EXIT_EASING,
        useNativeDriver: true,
      }),
    ]).start(() => onHide(id)); // the store runs config.onHide when it removes the toast
  }, [id, onHide, opacity, reduce, translateY]);

  useEffect(() => {
    if (preview) return undefined;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: m.in.duration, easing: ENTER_EASING, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: m.in.duration, easing: ENTER_EASING, useNativeDriver: true }),
    ]).start();

    // Announce only (no accessibilityLiveRegion), so Android does not read it twice.
    AccessibilityInfo.announceForAccessibility(label);

    if (duration > 0) {
      const timer = setTimeout(hide, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [duration, hide, label, opacity, preview, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy < 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -componentTokens.toast.swipeDismissDistance) {
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
      {...(preview ? null : panResponder.panHandlers)}
      testID={preview ? `toast-preview-${type}` : 'toast'}
      style={[
        preview ? styles.preview : [styles.container, { top: insets.top + space[2] + topOffset }],
        theme.elevation[4],
        {
          backgroundColor: fill,
          opacity,
          transform: [{ translateY }],
        },
        dark ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
      {/* Plain row: the message and the action are separate accessibility elements. */}
      <View style={styles.content}>
        <Pressable
          style={styles.body}
          onPress={isLoading ? undefined : hide}
          disabled={isLoading}
          accessible
          accessibilityRole={isLoading ? 'text' : 'button'}
          accessibilityLabel={label}
          accessibilityHint={isLoading ? undefined : t('kit.toastDismissHint')}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={toneColor.loading} />
          ) : (
            <View testID={`toast-icon-${type}`}>
              <Icon name={ICONS[type]} size={20} tint={toneColor[type]} />
            </View>
          )}
          <View style={styles.text}>
            <AppText variant="bodySmall" numberOfLines={2} style={{ color: textColor }}>
              {title}
            </AppText>
            {message ? (
              <AppText variant="bodySmall" numberOfLines={2} style={{ color: textColor }}>
                {message}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        {action ? (
          <Pressable
            style={styles.action}
            onPress={() => {
              action.onPress();
              hide();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <AppText variant="buttonSmall" numberOfLines={1} style={{ color: inverse.primaryText }}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const hideToast = (id: string) => toast.hide(id);

/**
 * Renders the queued toasts one at a time. Mounted by NotificationManager (app root) and by
 * `ModalRoot` (`inline`, inside native Modals); only the active host renders, so a toast asked
 * for while a modal sheet is up (a failed share from the SOS sheet) shows above that sheet
 * instead of under it. Screens never mount it.
 */
export function ToastHost({ inline = false }: { inline?: boolean }) {
  const current = useSyncExternalStore(toastStore.subscribe, toastStore.getCurrent);
  const active = useSyncExternalStore(toastStore.subscribe, toastStore.getActiveHost);
  const [hostId, setHostId] = useState<number | null>(null);
  useEffect(() => {
    // Hosts inside a Modal (inline) outrank the root host.
    const host = toastStore.registerHost(inline ? 1 : 0);
    setHostId(host.id);
    return host.unregister;
  }, [inline]);
  if (!current || hostId === null || active !== hostId) return null;
  // The key remounts it so each toast animates and times out on its own.
  return <ToastView key={current.id} config={current} onHide={hideToast} />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    start: layout.gutter,
    end: layout.gutter,
    borderRadius: radius.md,
    zIndex: 1000,
  },
  preview: { borderRadius: radius.md },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: componentTokens.toast.minHeight, paddingEnd: space[2] },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingStart: space[4],
    paddingEnd: space[2],
    paddingVertical: space[3],
  },
  text: { flex: 1, minWidth: 0 },
  action: { minHeight: componentTokens.iconButton.target, justifyContent: 'center', paddingHorizontal: space[2] },
});
