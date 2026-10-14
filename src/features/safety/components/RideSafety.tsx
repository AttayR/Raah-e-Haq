import React, { useCallback, useContext, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { Button, IconButton } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { RideResource } from '../../../services/rideService';
import { useLiveShare, useSos } from '../hooks';
import { EMERGENCY_CONTACTS_ROUTE } from '../navigation';
import { canShareTrip, isSosAvailable } from '../rules';
import type { SosPosition } from '../types';
import { SosSheet } from './SosSheet';

type ContactsNavigator = {
  navigate(name: typeof EMERGENCY_CONTACTS_ROUTE): void;
};

/** Opens Account → Emergency contacts (both stacks register it); undefined outside a navigator. */
const useOpenContacts = (close: () => void): (() => void) | undefined => {
  // Context, not useNavigation (which throws outside a navigator, e.g. the kit gallery).
  const navigation: ContactsNavigator | undefined =
    useContext(NavigationContext);
  return navigation
    ? () => {
        close();
        navigation.navigate(EMERGENCY_CONTACTS_ROUTE);
      }
    : undefined;
};

type Props = {
  ride: RideResource;
  /** The phone's position, sent with an SOS when known. */
  position: SosPosition | null;
};

/**
 * The passenger's safety row on the trip panel (T-520): "Safety" opens the SOS sheet and "Share
 * trip" shares the live trip link (BE-80), "Sharing live" once it is shared. Shown from the
 * driver's acceptance until 30 min after the ride ended; nothing before a driver is assigned.
 */
export function PassengerTripSafety({ ride, position }: Props) {
  const [open, setOpen] = useState(false);
  const sos = useSos(ride.id);
  const shareable = canShareTrip(ride);
  const share = useLiveShare(shareable ? ride.id : null);
  const close = useCallback(() => setOpen(false), []);
  const openContacts = useOpenContacts(close);

  if (!isSosAvailable(ride)) return null;

  return (
    <View style={styles.column} testID="trip-safety">
      <View style={styles.row}>
        <View style={styles.cell}>
          <Button
            label={t('safety.sosButton')}
            accessibilityLabel={t('safety.sosButtonA11y')}
            variant="destructiveSoft"
            leadingIcon="sos"
            onPress={() => {
              haptics.impactLight();
              setOpen(true);
            }}
            testID="trip-safety-sos"
          />
        </View>
        {shareable ? (
          <View style={styles.cell}>
            <Button
              label={share.link ? t('safety.sharing') : t('safety.shareTrip')}
              accessibilityLabel={
                share.link ? t('safety.sharing') : t('safety.shareTripA11y')
              }
              variant="secondary"
              leadingIcon="share"
              onPress={share.start}
              loading={share.busy}
              testID="trip-safety-share"
            />
          </View>
        ) : null}
      </View>
      {shareable && share.link ? (
        <Button
          label={t('safety.stopSharing')}
          accessibilityLabel={t('safety.stopSharingA11y')}
          variant="ghost"
          size="sm"
          leadingIcon="shareOff"
          onPress={share.stop}
          disabled={share.busy}
          testID="trip-safety-stop-sharing"
        />
      ) : null}
      <SosSheet
        visible={open}
        onClose={close}
        role="passenger"
        sos={sos}
        position={position}
        share={shareable ? share : null}
        onAddContacts={openContacts}
      />
    </View>
  );
}

/**
 * The driver's floating shield on the ride map (T-520): the same SOS sheet (calls, alert my
 * contacts), from acceptance until 30 min after the ride ended.
 */
export function DriverRideSafetyButton({
  ride,
  position,
  style,
  size,
}: Props & { style?: StyleProp<ViewStyle>; size?: number }) {
  const [open, setOpen] = useState(false);
  const sos = useSos(ride.id);
  const close = useCallback(() => setOpen(false), []);
  const openContacts = useOpenContacts(close);

  if (!isSosAvailable(ride)) return null;

  return (
    <View style={style}>
      <IconButton
        icon="sos"
        variant="floating"
        size={size}
        iconColor="danger"
        onPress={() => {
          haptics.impactLight();
          setOpen(true);
        }}
        accessibilityLabel={t('safety.sosButtonA11y')}
        testID="driver-ride-sos"
      />
      <SosSheet
        visible={open}
        onClose={close}
        role="driver"
        sos={sos}
        position={position}
        onAddContacts={openContacts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: space[1] },
  row: { flexDirection: 'row', gap: space[2] },
  cell: { flex: 1 },
});
