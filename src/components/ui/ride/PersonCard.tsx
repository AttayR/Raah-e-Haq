import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Card } from '../Card';
import { Icon, type IconName } from '../Icon';
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
  testID?: string;
};

/** One of the equal tonal actions under the person (§12.5): 56 high, 24 glyph, caption label. */
function ActionButton({ action }: { action: PersonAction }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
      accessibilityHint={action.accessibilityHint}
      accessibilityState={{ disabled: !!action.disabled }}
      android_ripple={{ color: c.surfaceAltPressed }}
      testID={action.testID}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: pressed ? c.surfaceAltPressed : c.surfaceAlt },
        action.disabled ? styles.disabled : null,
      ]}
    >
      <View>
        <Icon name={action.icon} size={24} color="primaryText" />
        {action.badgeCount ? (
          <View style={styles.badge}>
            <Badge variant="count" count={action.badgeCount} />
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
  /** Passenger side: "Toyota Corolla · White". Hidden when null. */
  vehicleLine?: string | null;
  /** Passenger side: `vehicle.license_plate` in a 28pt pill. Hidden when null. */
  plate?: string | null;
  /** Driver arrived: a 2pt `primary` ring on the plate helps spot the car. */
  plateHighlighted?: boolean;
  /** Up to three equal actions (Call, Message, Safety / Navigate). */
  actions?: ReadonlyArray<PersonAction>;
  /** `card` (default) or `plain` inside a sheet that already is the card. */
  variant?: 'card' | 'plain';
  testID?: string;
  nameTestID?: string;
  ratingTestID?: string;
  vehicleTestID?: string;
  plateTestID?: string;
};

/**
 * Person card (DESIGN_SYSTEM §5.27, §5.28, §12.5): one component for the driver card (passenger
 * side: vehicle line + plate pill) and the passenger card (driver side: name and rating only).
 * Avatar 56 (initials fallback) · name `h3` · rating or "New" · then a row of equal tonal actions
 * with labels. No phone number is ever shown as text.
 */
export function PersonCard({
  name,
  fallbackName,
  photoUri,
  rating,
  newRatingLabel,
  vehicleLine,
  plate,
  plateHighlighted = false,
  actions = [],
  variant = 'card',
  testID,
  nameTestID,
  ratingTestID,
  vehicleTestID,
  plateTestID,
}: PersonCardProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const body = (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Avatar name={name || fallbackName} uri={photoUri} size={56} />
        <View style={styles.info}>
          <AppText variant="h3" numberOfLines={1} testID={nameTestID}>
            {name || fallbackName}
          </AppText>
          <RatingDisplay rating={rating} newLabel={newRatingLabel} valueTestID={ratingTestID} />
          {vehicleLine ? (
            <AppText variant="caption" color="textSecondary" numberOfLines={2} testID={vehicleTestID}>
              {vehicleLine}
            </AppText>
          ) : null}
        </View>
        {plate ? (
          <View
            accessible
            accessibilityLabel={t('ride.plateA11y', { plate })}
            style={[
              styles.plate,
              { backgroundColor: c.surfaceAlt },
              plateHighlighted ? { borderWidth: theme.borderWidth.focus, borderColor: c.primary } : null,
            ]}
          >
            <AppText variant="numeric" numberOfLines={1} style={styles.plateText} testID={plateTestID}>
              {plate}
            </AppText>
          </View>
        ) : null}
      </View>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.slice(0, 3).map(action => (
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

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  info: { flex: 1, minWidth: 0, gap: 2 },
  plate: {
    minHeight: p.plateHeight,
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    maxWidth: '40%',
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
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
