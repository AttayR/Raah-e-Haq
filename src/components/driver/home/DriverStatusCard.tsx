import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Card } from '../../ui';
import { radius, space, type SemanticColorName } from '../../../theme';
import { DRIVER_STATUS_COPY } from '../../../features/driver-status/copy';

export type DriverStatusView = 'checking' | 'online' | 'onRide' | 'offline';

type Props = {
  status: DriverStatusView;
  isBusy: boolean;
  disabled: boolean;
  onToggle: () => void;
};

const dotColor: Record<DriverStatusView, SemanticColorName> = {
  checking: 'textMuted',
  online: 'success',
  onRide: 'info',
  offline: 'textMuted',
};

const title: Record<DriverStatusView, string> = {
  checking: DRIVER_STATUS_COPY.checking,
  online: DRIVER_STATUS_COPY.online,
  onRide: DRIVER_STATUS_COPY.onRide,
  offline: DRIVER_STATUS_COPY.offline,
};

const subtitle: Record<DriverStatusView, string> = {
  checking: DRIVER_STATUS_COPY.updatingSubtitle,
  online: DRIVER_STATUS_COPY.goOfflineSubtitle,
  onRide: DRIVER_STATUS_COPY.onRideSubtitle,
  offline: DRIVER_STATUS_COPY.goOnlineSubtitle,
};

/** Size of the status dot and its ring (DESIGN driver-drive-home: 10 + 2pt ring). */
const DOT = 10;
const RING = 2;

/**
 * Online/offline card (driver-drive-home spec): status dot + state, one 56pt action. The
 * action is the server-backed toggle (T-401); this card only renders it.
 */
export function DriverStatusCard({ status, isBusy, disabled, onToggle }: Props) {
  const { theme } = useAppTheme();
  const online = status === 'online' || status === 'onRide';
  const label = online ? DRIVER_STATUS_COPY.goOffline : DRIVER_STATUS_COPY.goOnline;
  return (
    <Card testID="driver-home-status-card">
      <View accessible accessibilityLabel={`${title[status]}. ${subtitle[status]}`}>
        <View style={styles.titleRow}>
          <View style={[styles.ring, status === 'online' ? { backgroundColor: theme.colors.successSoft } : null]}>
            <View
              testID="driver-home-status-dot"
              style={[styles.dot, { backgroundColor: theme.colors[dotColor[status]] }]}
            />
          </View>
          <AppText variant="h3" style={styles.title}>
            {title[status]}
          </AppText>
        </View>
        <AppText variant="bodySmall" color="textSecondary" style={styles.subtitle}>
          {subtitle[status]}
        </AppText>
      </View>
      <View style={styles.action}>
        <Button
          testID="driver-home-action-online"
          label={label}
          size="lg"
          variant={online ? 'outline' : 'primary'}
          leadingIcon="power"
          onPress={onToggle}
          disabled={disabled}
          loading={isBusy && status !== 'checking'}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // The dot centres on the title line at any font scale.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  ring: {
    width: DOT + RING * 2,
    height: DOT + RING * 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill },
  title: { flex: 1, minWidth: 0 },
  // Subtitle aligns with the title text, past the dot.
  subtitle: { marginTop: space[1], marginStart: DOT + RING * 2 + space[2] },
  action: { marginTop: space[4] },
});
