import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import { AppText, Button, ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { BookingPlace } from '../../ride-booking/buildRideRequest';

type LatLng = { latitude: number; longitude: number };

type PointProps = {
  label: string;
  place: BookingPlace | null;
  /** Shown instead of the address while the point is the sender's position. */
  placeLabel?: string | null;
  searchPlaceholder: string;
  changeA11y: string;
  icon: 'origin' | 'pin';
  near: LatLng | null;
  error?: string;
  onPick: (place: BookingPlace) => void;
  testID: string;
};

/** One point: the chosen place with "Change", or the places search (as Saved places). */
function RoutePoint({ label, place, placeLabel, searchPlaceholder, changeA11y, icon, near, error, onPick, testID }: PointProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const title = placeLabel ?? place?.address ?? null;

  return (
    <View style={styles.point}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      {searching || !place || !title ? (
        <LocationSearch
          mode={icon === 'origin' ? 'pickup' : 'destination'}
          query={query}
          onChangeQuery={setQuery}
          near={near}
          placeholder={searchPlaceholder}
          onSelect={(s) => {
            onPick({ ...s.coords, address: suggestionAddress(s) });
            setSearching(false);
            setQuery('');
          }}
        />
      ) : (
        <ListGroup>
          <ListItem
            icon={icon}
            title={title}
            trailing={
              <Button
                label={t('parcel.change')}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setSearching(true)}
                accessibilityLabel={changeA11y}
                testID={`${testID}-change`}
              />
            }
            testID={testID}
          />
        </ListGroup>
      )}
      {error ? (
        <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID={`${testID}-error`}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

type Props = {
  pickup: BookingPlace | null;
  pickupIsGps: boolean;
  dropoff: BookingPlace | null;
  near: LatLng | null;
  pickupError?: string;
  dropoffError?: string;
  onPickup: (place: BookingPlace) => void;
  onDropoff: (place: BookingPlace) => void;
};

/** Pickup (the sender's position until changed) and drop-off of the parcel. No stops (BE-88). */
export function ParcelRouteSection({ pickup, pickupIsGps, dropoff, near, pickupError, dropoffError, onPickup, onDropoff }: Props) {
  return (
    <View style={styles.section}>
      <AppText variant="title" accessibilityRole="header">
        {t('parcel.routeTitle')}
      </AppText>
      <RoutePoint
        label={t('parcel.pickupLabel')}
        place={pickup}
        placeLabel={pickup && pickupIsGps ? pickup.address ?? t('parcel.currentLocation') : null}
        searchPlaceholder={t('parcel.pickupSearch')}
        changeA11y={t('parcel.changePickupA11y')}
        icon="origin"
        near={near}
        error={pickupError}
        onPick={onPickup}
        testID="parcel-pickup"
      />
      <RoutePoint
        label={t('parcel.dropoffLabel')}
        place={dropoff}
        searchPlaceholder={t('parcel.dropoffSearch')}
        changeA11y={t('parcel.changeDropoffA11y')}
        icon="pin"
        near={pickup ?? near}
        error={dropoffError}
        onPick={onDropoff}
        testID="parcel-dropoff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  point: { gap: space[2] },
});
