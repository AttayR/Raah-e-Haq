import React, { useCallback, useContext, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { IconButton } from '../../../components/ui';
import { haptics } from '../../../core/haptics';
import { t } from '../../../i18n';
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
 * The passenger's Safety shield on the ride map (UI-R12, shared-trip-sheet TS2): a floating 48
 * IconButton at the top end, `shield-alert-outline` in `danger`, opening the SOS sheet (calls 15 /
 * 1122, alert my contacts, share the trip). Shown from the driver's acceptance until 30 min after
 * the ride ended (T-520); nothing before a driver is assigned. It replaces the old SOS + Share
 * button row under the PIN (Share is now the PersonCard's third action).
 */
export function PassengerSafetyShield({ ride, position, size }: Props & { size?: number }) {
  const [open, setOpen] = useState(false);
  const sos = useSos(ride.id);
  const shareable = canShareTrip(ride);
  const share = useLiveShare(shareable ? ride.id : null);
  const close = useCallback(() => setOpen(false), []);
  const openContacts = useOpenContacts(close);

  const available = isSosAvailable(ride);

  // [T-565] The SOS sheet stays mounted when the shield goes (30 min after the ride): it closes
  // through `visible` instead of unmounting a presented Modal.
  return (
    <>
      {available ? (
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
          testID="trip-safety-sos"
        />
      ) : null}
      <SosSheet
        visible={open && available}
        onClose={close}
        role="passenger"
        sos={sos}
        position={position}
        share={shareable ? share : null}
        onAddContacts={openContacts}
      />
    </>
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

  const available = isSosAvailable(ride);

  // [T-565] As above: the sheet is always rendered and closes through `visible`.
  return (
    <>
      {available ? (
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
        </View>
      ) : null}
      <SosSheet
        visible={open && available}
        onClose={close}
        role="driver"
        sos={sos}
        position={position}
        onAddContacts={openContacts}
      />
    </>
  );
}

