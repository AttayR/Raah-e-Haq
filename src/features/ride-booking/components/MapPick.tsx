import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, CentrePin, Chip, Skeleton, SkeletonGroup } from '../../../components/ui';
import { componentTokens, radius, space, textStyles } from '../../../theme';
import { BOOKING_COPY } from '../copy';
import type { MapPicker } from '../useMapPicker';

/**
 * Turns on the explicit "choose on map" mode (T-304, PAX-14). UI-R9: a kit Chip with the
 * `map-marker-outline` glyph (passenger-destination-search quick row), not a hand-styled pill.
 */
export const ChooseOnMapButton: React.FC<{ label?: string; onPress: () => void; testID?: string }> = ({
  label = BOOKING_COPY.chooseOnMap,
  onPress,
  testID = 'choose-on-map',
}) => <Chip icon="pinOutline" tone="primary" label={label} onPress={onPress} testID={testID} style={styles.hug} />;

const pin = componentTokens.ride.centrePin;

type OverlayProps = {
  picker: MapPicker;
  /** The card's height, so the locate control rides 16 above it (as above the sheet). */
  onHeight: (height: number) => void;
};

/**
 * UI-R9b: the full-screen centre-pin picker over the booking map (passenger-destination-search
 * block 5): the CentrePin on the map's centre (lifted while the map moves) and the bottom card
 * (padding 16, `elevation.3`, top radius `xl`): `caption` "Pickup" / "Drop-off" / "Stop", the
 * address under the pin in `title` (1-2 lines; a skeleton while the map moves or the lookup runs;
 * "Pinned on map" when none is found) and the `lg` primary "Confirm …" (held while moving). The
 * map's Back closes it. Rendered only while the picker is open.
 */
export function MapPickOverlay({ picker, onHeight }: OverlayProps) {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { target, moving, address, resolving } = picker;
  if (!target) return null;
  const looking = moving || resolving;
  return (
    <>
      <CentrePin kind={target} lifted={moving} />
      <View
        style={[
          styles.card,
          theme.elevation[3],
          { backgroundColor: theme.colors.surface, paddingBottom: Math.max(insets.bottom + space[2], space[4]) },
          theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
        ]}
        onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}
        testID="map-pick-card"
      >
        <View
          style={styles.text}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={looking ? BOOKING_COPY.mapPickFindingA11y : undefined}
          accessibilityHint={BOOKING_COPY.mapPickHint}
        >
          <AppText variant="caption" color="textSecondary" testID="map-pick-label">
            {BOOKING_COPY.mapPickLabel(target)}
          </AppText>
          {looking ? (
            <SkeletonGroup accessibilityLabel={BOOKING_COPY.mapPickFindingA11y} testID="map-pick-address-loading">
              <Skeleton width={pin.addressSkeletonWidth} textVariant="title" />
            </SkeletonGroup>
          ) : (
            <AppText variant="title" numberOfLines={2} testID="map-pick-address">
              {address ?? BOOKING_COPY.pinnedOnMap}
            </AppText>
          )}
        </View>
        <Button
          label={BOOKING_COPY.mapPickConfirm(target)}
          size="lg"
          haptic="impactLight"
          onPress={picker.confirm}
          disabled={moving}
          testID="map-pick-confirm"
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // In a column it hugs its label instead of stretching to the sheet width.
  hug: { alignSelf: 'flex-start' },
  card: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space[4],
    paddingTop: space[4],
    gap: space[4],
  },
  // The caption and one title line: the card keeps its height between the skeleton and the address.
  text: { gap: space[1], minHeight: textStyles.caption.lineHeight + space[1] + textStyles.title.lineHeight },
});
