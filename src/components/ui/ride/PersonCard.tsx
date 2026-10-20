import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Card } from '../Card';
import { Icon, type IconName } from '../Icon';
import { IconButton } from '../IconButton';
import { RatingDisplay } from './RatingStars';

const p = componentTokens.ride.person;

export type PersonAction = {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Unread messages on the Message action. */
  badgeCount?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  /** [UI-R12] Work in flight (creating a share link): a 20 spinner in place of the glyph, no taps. */
  busy?: boolean;
  /** [UI-R12] A 6 pt `success` dot on the glyph's top-end (Share while a live link exists, TS5). */
  dot?: boolean;
  testID?: string;
};

/** One of the equal tonal actions under the person (§12.5): 56 high, 24 glyph, caption label. */
function ActionButton({ action }: { action: PersonAction }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const inactive = !!action.disabled || !!action.busy;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityHint={action.accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: !!action.busy }}
      android_ripple={{ color: c.surfaceAltPressed }}
      testID={action.testID}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? c.surfaceAltPressed : c.surfaceAlt },
        action.disabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.glyph}>
        {action.busy ? (
          <ActivityIndicator size="small" color={c.primaryText} testID={action.testID ? `${action.testID}-spinner` : undefined} />
        ) : (
          <Icon name={action.icon} size={24} color="primaryText" />
        )}
        {action.dot && !action.busy ? (
          <View
            style={[styles.dot, { backgroundColor: c.success, borderColor: c.surfaceAlt, borderWidth: theme.borderWidth.thin }]}
            testID={action.testID ? `${action.testID}-dot` : undefined}
          />
        ) : null}
        {action.badgeCount ? (
          <View style={styles.badge}>
            <Badge variant="count" count={action.badgeCount} testID={action.testID ? `${action.testID}-badge` : undefined} />
          </View>
        ) : null}
      </View>
      <AppText variant="label" numberOfLines={1}>
        {action.label}
      </AppText>
    </Pressable>
  );
}

export type PersonCardProps = {
  /** First name (driver side: first name + initial, BE-20). Null shows `fallbackName`. */
  name: string | null | undefined;
  fallbackName: string;
  photoUri?: string | null;
  rating?: number | null;
  /** Shown instead of a rating: "New" (default) or "New rider". */
  newRatingLabel?: string;
  /**
   * Passenger side: make and model ("Mitsubishi Outlander"), one line, ellipsized. T-524: the
   * old single "make model · colour" line broke mid-way ("Mitsubishi Outlander · / Silver").
   */
  vehicleName?: string | null;
  /** Passenger side: the colour on its own line, so it is never cut (what the passenger looks for). */
  vehicleColor?: string | null;
  /**
   * [UI-R12] `joined`: one `caption` "{make} {model} · {colour}" wrapping to 2 lines (TS5, the
   * trip sheets). `split` (default): make and model, then the colour on its own line.
   */
  vehicleLayout?: 'split' | 'joined';
  /** Passenger side: `vehicle.license_plate` in a 28pt pill. Hidden when null. */
  plate?: string | null;
  /** Driver arrived: a 2pt `primary` ring on the plate helps spot the car. */
  plateHighlighted?: boolean;
  /** Up to three equal actions (Call, Message, Safety / Navigate). */
  actions?: ReadonlyArray<PersonAction>;
  /** `card` (default) or `plain` inside a sheet that already is the card. */
  variant?: 'card' | 'plain';
  /**
   * [UI-R11] `compact`: Avatar 40 and the name in `title` (the rider row of the incoming request,
   * driver-incoming-request R2 #8). Default `regular` (Avatar 56, name `h3`).
   */
  size?: 'regular' | 'compact';
  /** [UI-R11] A `caption` after the rating on the same line (" · 3 passengers"). */
  ratingSuffix?: string | null;
  /**
   * [UI-R12/R13] `row` (default): the actions in a row of 56 cells under the identity row.
   * `inline`: trailing tonal 48 IconButtons in the identity row (driver, compact height < 700,
   * shared-trip-sheet TS5); no action row.
   */
  actionsLayout?: 'row' | 'inline';
  testID?: string;
  nameTestID?: string;
  ratingTestID?: string;
  vehicleTestID?: string;
  plateTestID?: string;
};

/**
 * Person card (DESIGN_SYSTEM §5.27, §5.28, §12.5): one component for the driver card (passenger
 * side: make and model, colour under it, plate pill) and the passenger card (driver side: name
 * and rating only).
 * Avatar 56 (initials fallback) · name `h3` · rating or "New" · then a row of equal tonal actions
 * with labels. No phone number is ever shown as text.
 */
export function PersonCard({
  name,
  fallbackName,
  photoUri,
  rating,
  newRatingLabel,
  vehicleName,
  vehicleColor,
  vehicleLayout = 'split',
  plate,
  plateHighlighted = false,
  actions = [],
  variant = 'card',
  size = 'regular',
  ratingSuffix,
  actionsLayout = 'row',
  testID,
  nameTestID,
  ratingTestID,
  vehicleTestID,
  plateTestID,
}: PersonCardProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const inline = actionsLayout === 'inline';
  const [plateWidth, setPlateWidth] = useState(0);
  const shownActions = actions.slice(0, 3);
  const body = (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={name || fallbackName} uri={photoUri} size={size === 'compact' ? 40 : 56} />
        <View style={styles.info}>
          <AppText variant={size === 'compact' ? 'title' : 'h3'} numberOfLines={1} testID={nameTestID}>
            {name || fallbackName}
          </AppText>
          {ratingSuffix ? (
            <View style={styles.ratingRow}>
              <RatingDisplay rating={rating} newLabel={newRatingLabel} valueTestID={ratingTestID} />
              <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.flexShrink}>
                {` · ${ratingSuffix}`}
              </AppText>
            </View>
          ) : (
            <RatingDisplay rating={rating} newLabel={newRatingLabel} valueTestID={ratingTestID} />
          )}
          {vehicleLayout === 'joined' ? (
            vehicleName || vehicleColor ? (
              <AppText variant="caption" color="textSecondary" numberOfLines={2} testID={vehicleTestID}>
                {[vehicleName, vehicleColor].filter(Boolean).join(' · ')}
              </AppText>
            ) : null
          ) : vehicleName ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={1} testID={vehicleTestID}>
              {vehicleName}
            </AppText>
          ) : null}
          {vehicleLayout === 'split' && vehicleColor ? (
            <AppText
              variant="caption"
              color="textSecondary"
              numberOfLines={1}
              testID={vehicleTestID ? `${vehicleTestID}-color` : undefined}
            >
              {vehicleColor}
            </AppText>
          ) : null}
        </View>
        {plate ? (
          <View
            accessible
            accessibilityLabel={t('ride.plateA11y', { plate })}
            onLayout={(e: LayoutChangeEvent) => {
              const next = Math.round(e.nativeEvent.layout.width);
              setPlateWidth(prev => (prev === next ? prev : next));
            }}
            style={[
              styles.plate,
              { backgroundColor: c.surfaceAlt },
              plateHighlighted ? { borderWidth: theme.borderWidth.focus, borderColor: c.primary } : null,
            ]}
          >
            {/* T-561: a long plate shrinks to fit (never cut off: it is how the car is found). [UI-R12 r2]
                A plate that always fits (≤ 9 characters) never shrinks; a longer one is re-keyed on
                the pill's measured width, so iOS sizes it again after a layout swap (it stuck at ~5 pt). */}
            <AppText
              key={plateShrinks(plate) ? `${plate}:${plateWidth}` : plate}
              variant="numeric"
              numberOfLines={1}
              adjustsFontSizeToFit={plateShrinks(plate)}
              minimumFontScale={plateShrinks(plate) ? PLATE_MIN_FONT_SCALE : undefined}
              style={styles.plateText}
              testID={plateTestID}
            >
              {plate}
            </AppText>
          </View>
        ) : null}
        {inline
          ? shownActions.map(action => {
              const button = (
                <IconButton
                  key={action.key}
                  icon={action.icon}
                  variant="tonal"
                  size={p.inlineAction}
                  onPress={action.onPress}
                  disabled={!!action.disabled || !!action.busy}
                  accessibilityLabel={action.accessibilityLabel ?? action.label}
                  testID={action.testID}
                />
              );
              // The unread count sits on the button's top-end, as on the row layout (the label says it).
              return action.badgeCount ? (
                <View key={action.key}>
                  {button}
                  <View style={styles.inlineBadge} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Badge variant="count" count={action.badgeCount} testID={action.testID ? `${action.testID}-badge` : undefined} />
                  </View>
                </View>
              ) : (
                button
              );
            })
          : null}
      </View>
      {!inline && shownActions.length > 0 ? (
        <View style={styles.actions}>
          {shownActions.map(action => (
            <ActionButton key={action.key} action={action} />
          ))}
        </View>
      ) : null}
    </View>
  );
  if (variant === 'plain') {
    return <View testID={testID}>{body}</View>;
  }
  return <Card testID={testID}>{body}</Card>;
}

/** The smallest a long plate is drawn (of the numeric size) before it would be cut off. */
export const PLATE_MIN_FONT_SCALE = 0.6;

/** [UI-R12 r2] Plates up to this many characters always fit the pill at full size. */
export const PLATE_FIT_CHARS = 9;

/** Whether a plate may shrink to fit (only longer plates; a short one keeps its full size). */
export const plateShrinks = (plate: string): boolean => plate.length > PLATE_FIT_CHARS;

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  info: { flex: 1, minWidth: 0, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  flexShrink: { flexShrink: 1 },
  plate: {
    minHeight: p.plateHeight,
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: '45%',
  },
  plateText: { letterSpacing: p.plateLetterSpacing },
  actions: { flexDirection: 'row', gap: p.actionGap },
  action: {
    flex: 1,
    minHeight: p.actionHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: space[1],
    paddingVertical: space[1],
  },
  badge: { position: 'absolute', top: -space[1], end: -space[2] },
  inlineBadge: { position: 'absolute', top: -space[1], end: -space[1] },
  glyph: { minWidth: p.glyph, minHeight: p.glyph, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 0,
    end: 0,
    width: componentTokens.tripSheet.sharingDot,
    height: componentTokens.tripSheet.sharingDot,
    borderRadius: componentTokens.tripSheet.sharingDot,
  },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
