import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { DRIVER_REQUESTS_COPY as COPY } from '../../../features/driver-requests/copy';
import { componentTokens, space } from '../../../theme';
import { AppText, Button, Icon, type CountdownSpec } from '../../ui';

const k = componentTokens.requestSheet;

type FooterProps = {
  rideId: number;
  onDecline: (rideId: number) => void;
  onAccept: (rideId: number) => void;
  /** This request's accept is in flight: Accept spins (ring hidden), Decline is disabled. */
  accepting: boolean;
  /** Another accept is in flight (one at a time). */
  disabled: boolean;
  /** The decision clock (R3); null until the sheet is up and the app is active. */
  countdown: CountdownSpec | null;
  /** Seconds to say at the R8 moments (10, 5), else null: the label stays "Accept". */
  announceSeconds: number | null;
};

/**
 * The request footer (R2 F, R3): Decline `lg ghost` (flex 1) and Accept `lg primary` (flex 2)
 * with the countdown ring, 12 apart, both 56 high. The Accept label carries the seconds only at
 * 10 s and 5 s (R8), never every second.
 */
function RequestFooterBase({
  rideId,
  onDecline,
  onAccept,
  accepting,
  disabled,
  countdown,
  announceSeconds,
}: FooterProps) {
  return (
    <>
      <View style={styles.decline}>
        <Button
          label={COPY.decline}
          variant="ghost"
          size="lg"
          onPress={() => onDecline(rideId)}
          disabled={disabled}
          accessibilityLabel={COPY.declineA11y}
          testID="incoming-request-reject"
        />
      </View>
      <View style={styles.accept}>
        <Button
          label={COPY.accept}
          size="lg"
          haptic="impactLight"
          onPress={() => onAccept(rideId)}
          disabled={disabled && !accepting}
          loading={accepting}
          countdown={countdown ?? undefined}
          accessibilityLabel={
            accepting ? COPY.accepting : announceSeconds !== null ? COPY.acceptA11y(announceSeconds) : COPY.accept
          }
          testID="incoming-request-accept"
        />
      </View>
    </>
  );
}

export const RequestFooter = memo(RequestFooterBase);

/**
 * R5 "taken" / "no longer available": the request content swaps to a 64 `surfaceAlt` circle with
 * the 32 `car-clock` glyph and a centred `h3`; no footer; the host leaves after 2 s.
 */
export function RequestGoneContent({ kind }: { kind: 'taken' | 'gone' }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.gone} accessibilityLiveRegion="polite" testID={`incoming-request-${kind}`}>
      <View style={[styles.circle, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Icon name="rideTaken" size={k.stateGlyph} color="textSecondary" />
      </View>
      <AppText variant="h3" align="center" accessibilityRole="header">
        {kind === 'taken' ? COPY.taken : COPY.gone}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  decline: { flex: 1 },
  accept: { flex: 2 },
  gone: { alignItems: 'center', gap: space[4], paddingVertical: space[4] },
  circle: {
    width: k.stateCircle,
    height: k.stateCircle,
    borderRadius: k.stateCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
