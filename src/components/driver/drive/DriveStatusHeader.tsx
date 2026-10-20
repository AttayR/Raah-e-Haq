import React, { memo, useEffect, useRef } from 'react';
import { I18nManager, Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { perLocale, t } from '../../../i18n';
import {
  borderWidth,
  componentTokens,
  layout,
  motion,
  motionPatterns,
  radius,
  space,
  textStyles,
} from '../../../theme';
import { AppText, Badge, Icon, Skeleton } from '../../ui';
import { DRIVE_NOTICE, isProblemNotice, type DriveNoticeKind, type DriveStatus } from './driveNotice';

export type { DriveStatus } from './driveNotice';

const STATUS_TEXT = perLocale(
  (): Record<DriveStatus, string> => ({
    checking: t('drive.checking'),
    offline: t('drive.youAreOffline'),
    online: t('drive.youAreOnline'),
    onRide: t('drive.onRide'),
  }),
);

const d = componentTokens.drive;
const pulse = motionPatterns.onlinePulse;

type Props = {
  status: DriveStatus;
  autoAccept?: boolean;
  /** The D2 subtitle (`driveNotice`); default: the status hint. */
  notice?: DriveNoticeKind;
  /** The feed-error notice's "Retry" link; omitted when a retry cannot help. */
  onRetry?: () => void;
  /** Measured height (the peek is measured, D1). */
  onHeight?: (height: number) => void;
  /** Cold-open entrance (D6). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Drive sheet status block (UI-R11, driver-drive-home D2/D3): the 12 status dot (online: `success`
 * with a 2 pt `successSoft` ring, 16 outer; on a ride `info`), the `h3` status and the Auto badge,
 * then the subtitle slot 2 below, start-aligned with the text, carrying the hint or the first
 * notice that applies (device offline, uploads failing, feed error + Retry, no fix, weak GPS).
 * Becoming online crossfades the dot and plays one ring pulse (600 ms); the 2 pt searching shimmer
 * runs 6 under the subtitle while online with no notice. Reduce Motion: no pulse, a still bar.
 * One summary element for screen readers; the subtitle is a polite live region.
 */
function DriveStatusHeaderBase({ status, autoAccept = false, notice, onRetry, onHeight, style }: Props) {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const kind: DriveNoticeKind =
    notice ?? (status === 'online' ? (autoAccept ? 'autoAccept' : 'online') : status === 'onRide' ? 'onRide' : status);
  const view = DRIVE_NOTICE()[kind];
  const online = status === 'online';
  const dotColor = online ? theme.colors.success : status === 'onRide' ? theme.colors.info : theme.colors.textMuted;

  // D3: dot colour and status text crossfade (150); one ring pulse on becoming online.
  const fade = useSharedValue(1);
  const ring = useSharedValue(0);
  const previous = useRef(status);
  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (was === status || reduce) return;
    fade.value = 0;
    fade.value = withTiming(1, { duration: motion.fast.duration });
    if (status === 'online' && was === 'offline') {
      ring.value = 0;
      ring.value = withTiming(1, {
        duration: pulse.durationMs,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [fade, reduce, ring, status]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 && ring.value < 1 ? pulse.opacityFrom * (1 - ring.value) : 0,
    transform: [{ scale: 1 + (pulse.scaleTo - 1) * ring.value }],
  }));

  const statusText = STATUS_TEXT()[status];
  const subtitle = kind === 'checking' ? '' : view.text;
  const onLayout = (e: LayoutChangeEvent) => onHeight?.(Math.round(e.nativeEvent.layout.height));

  return (
    <Animated.View style={[styles.header, style]} onLayout={onLayout} testID="drive-status">
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={subtitle ? t('drive.statusA11y', { status: statusText, subtitle }) : statusText}
      >
        <View style={styles.statusRow}>
          <View style={styles.dotBox}>
            <Animated.View style={[styles.pulse, { borderColor: theme.colors.success }, ringStyle]} />
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: dotColor },
                online ? [styles.dotOnline, { borderColor: theme.colors.successSoft }] : null,
                fadeStyle,
              ]}
              testID={`drive-status-dot-${status}`}
            />
          </View>
          <Animated.View style={[styles.flex, fadeStyle]}>
            <AppText variant="h3" numberOfLines={1}>
              {statusText}
            </AppText>
          </Animated.View>
          {online && autoAccept ? (
            // T-587 (map-vehicles.md §7.3): matching rides are accepted for the driver.
            <Badge tone="primary" icon="autoAccept" label={t('autoAccept.badge')} testID="drive-auto-badge" />
          ) : null}
        </View>
        <View
          style={[styles.subtitle, kind === 'feedFailed' && onRetry ? styles.subtitleWithRetry : null]}
          accessibilityLiveRegion={isProblemNotice(kind) ? 'polite' : 'none'}
        >
          {kind === 'checking' ? (
            <Skeleton width={160} height={12} testID="drive-hint-skeleton" />
          ) : (
            <>
              {view.icon ? <Icon name={view.icon} size={16} color={view.tone} /> : null}
              <AppText variant="bodySmall" color={view.tone} numberOfLines={2} style={styles.flex} testID="drive-hint">
                {view.text}
              </AppText>
            </>
          )}
        </View>
      </View>
      {kind === 'feedFailed' && onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={space[3]}
          accessibilityRole="button"
          accessibilityLabel={t('drive.noticeRetryA11y')}
          style={styles.retry}
          testID="drive-notice-retry"
        >
          <AppText variant="buttonSmall" color="primaryText">
            {t('drive.noticeRetry')}
          </AppText>
        </Pressable>
      ) : null}
      {online && !isProblemNotice(kind) ? <SearchingShimmer /> : null}
    </Animated.View>
  );
}

export const DriveStatusHeader = memo(DriveStatusHeaderBase);

function SearchingShimmer() {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  // Track width (UI thread): the bar moves with translateX, never a layout prop.
  const width = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      progress.value = 0.5;
      return undefined;
    }
    progress.value = withRepeat(withTiming(1, { duration: motionPatterns.searchingProgressLoopMs }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, reduce]);
  // From 30 % before the start edge to past the end (the bar is 30 % wide); mirrored in RTL.
  const style = useAnimatedStyle(() => {
    const x = (progress.value * 1.3 - 0.3) * width.value;
    return { transform: [{ translateX: I18nManager.isRTL ? -x : x }] };
  });
  return (
    <View
      style={[styles.track, { backgroundColor: theme.colors.successSoft }]}
      accessibilityLabel={t('drive.searchingA11y')}
      onLayout={e => {
        width.value = e.nativeEvent.layout.width;
      }}
      testID="drive-searching"
    >
      <Animated.View style={[styles.shimmer, { backgroundColor: theme.colors.success }, style]} />
    </View>
  );
}

/** Text column start: dot 12 + 12 gap (D2). */
const TEXT_START = d.statusDot + space[3];

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: layout.gutter },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dotBox: {
    width: d.statusDot,
    height: d.statusDot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: d.statusDot,
    height: d.statusDot,
    borderRadius: radius.pill,
    position: 'absolute',
  },
  // Online: the 12 dot plus a 2 pt `successSoft` ring around it (16 outer).
  dotOnline: {
    width: d.statusRing,
    height: d.statusRing,
    borderWidth: borderWidth.focus,
  },
  pulse: {
    position: 'absolute',
    width: d.statusRing,
    height: d.statusRing,
    borderRadius: radius.pill,
    borderWidth: borderWidth.focus,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    marginTop: d.subtitleGap,
    marginStart: TEXT_START,
    minHeight: textStyles.bodySmall.lineHeight,
  },
  // Room for the trailing "Retry" / "Dobara" link on the subtitle line.
  subtitleWithRetry: { paddingEnd: space[16] },
  retry: {
    position: 'absolute',
    end: layout.gutter,
    bottom: 0,
    minHeight: textStyles.bodySmall.lineHeight,
    justifyContent: 'center',
  },
  // 6 under the subtitle, inside the 12 gap above the auto-accept row; no layout height (D2).
  track: {
    position: 'absolute',
    start: layout.gutter + TEXT_START,
    end: layout.gutter,
    bottom: -space[2],
    height: borderWidth.focus,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '30%',
    borderRadius: radius.pill,
  },
});
