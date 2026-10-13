import React, { useCallback, useState } from 'react';
import {
  I18nManager,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { haptics } from '../../../core/haptics';
import { t, type TranslationKey } from '../../../i18n';
import { componentTokens, space } from '../../../theme';
import { AppText } from '../AppText';
import { Icon } from '../Icon';

const r = componentTokens.ride.rating;
export const MAX_STARS = 5;

/** A usable 1–5 rating, or null ("New"): zero, missing or out-of-range values are not ratings. */
export const displayRating = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return n > 0 && n <= MAX_STARS ? n : null;
};

type DisplayProps = {
  /** `user.rating` from the API; null/0 shows `newLabel`. */
  rating: number | null | undefined;
  /** Shown without a rating: "New" (default), "New rider" on the driver side. */
  newLabel?: string;
  /** testID on the numeric value (screen tests read it). */
  valueTestID?: string;
  testID?: string;
};

/**
 * Rating display (DESIGN_SYSTEM §5.22): a 16pt `ratingStar` star and the value in `numeric`, one
 * decimal. Without a rating: "New" in `caption` `textMuted`, never four hardcoded stars.
 */
export function RatingDisplay({ rating, newLabel = t('ride.ratingNew'), valueTestID, testID }: DisplayProps) {
  const value = displayRating(rating);
  if (value === null) {
    return (
      <View testID={testID} accessible accessibilityLabel={t('ride.ratingNewA11y')} style={styles.display}>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {newLabel}
        </AppText>
      </View>
    );
  }
  const text = value.toFixed(1);
  return (
    <View testID={testID} accessible accessibilityLabel={t('ride.ratingA11y', { rating: text })} style={styles.display}>
      <Icon name="star" size={16} color="ratingStar" />
      <AppText variant="numeric" numberOfLines={1} testID={valueTestID}>
        {text}
      </AppText>
    </View>
  );
}

const LABELS: Record<number, TranslationKey> = {
  1: 'ride.rating1',
  2: 'ride.rating2',
  3: 'ride.rating3',
  4: 'ride.rating4',
  5: 'ride.rating5',
};

/** "Very bad" … "Excellent" for 1–5; '' for 0. */
export const ratingLabel = (value: number): string => (LABELS[value] ? t(LABELS[value]) : '');

/** Which star (1–5) a touch at `x` along a `width`-wide row selects; mirrored in RTL. */
export const starAt = (x: number, width: number, rtl: boolean = I18nManager.isRTL): number => {
  if (width <= 0) return 0;
  const along = rtl ? width - x : x;
  return Math.min(MAX_STARS, Math.max(1, Math.ceil((along / width) * MAX_STARS)));
};

type InputProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * Rating input (§5.22): five 40pt stars, 8 apart, each a 48pt target; tap or drag to select;
 * label under the row ("Very bad" … "Excellent"); haptic `selection` per change. Screen readers
 * get one adjustable control (swipe up/down).
 */
export function RatingInput({ value, onChange, disabled = false, testID }: InputProps) {
  const [width, setWidth] = useState(0);
  const select = useCallback(
    (next: number) => {
      if (disabled || next === value || next < 1 || next > MAX_STARS) return;
      haptics.selection();
      onChange(next);
    },
    [disabled, onChange, value],
  );
  const onTouch = (e: GestureResponderEvent) => select(starAt(e.nativeEvent.locationX, width));
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') select(Math.min(MAX_STARS, value + 1));
    if (e.nativeEvent.actionName === 'decrement') select(Math.max(1, value - 1));
  };
  const label = ratingLabel(value);
  return (
    <View style={styles.input} testID={testID}>
      <View
        style={styles.row}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('ride.ratingInputA11y')}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: 0,
          max: MAX_STARS,
          now: value,
          text: value ? t('ride.ratingInputValue', { n: value, label }) : t('ride.ratingInputNone'),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        testID={testID ? `${testID}-row` : undefined}
      >
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <View key={i} style={styles.target} pointerEvents="none" testID={testID ? `${testID}-star-${i + 1}` : undefined}>
            <Icon name={i < value ? 'star' : 'starOutline'} size={40} color={i < value ? 'ratingStar' : 'borderStrong'} />
          </View>
        ))}
      </View>
      <AppText variant="bodySmall" color="textSecondary" align="center" testID={testID ? `${testID}-label` : undefined}>
        {label || ' '}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  display: { flexDirection: 'row', alignItems: 'center', gap: r.displayGap },
  input: { alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', gap: r.inputGap - (r.inputTarget - r.input) },
  target: { width: r.inputTarget, height: r.inputTarget, alignItems: 'center', justifyContent: 'center' },
});
