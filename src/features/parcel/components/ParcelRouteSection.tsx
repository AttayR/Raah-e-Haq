import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import LocationSearch, { suggestionAddress } from '../../../components/passenger/LocationSearch';
import { AppText, Button, KeyboardRevealGroup, ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { BookingPlace } from '../../ride-booking/buildRideRequest';
import type { ParcelAnchor } from '../useSendParcel';

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
  /** T-578: so a refused submit can scroll to this point. */
  anchorRef?: (node: View | null) => void;
  testID: string;
};

/** One point: the chosen place with "Change", or the places search (as Saved places). */
function RoutePoint({ label, place, placeLabel, searchPlaceholder, changeA11y, icon, near, error, onPick, anchorRef, testID }: PointProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const title = placeLabel ?? place?.address ?? null;

  return (
    // T-578: the wrapper lets a refused submit scroll to this point.
    <View ref={anchorRef}>
      {/* T-561: the label, the search field and its suggestions are kept in view above the keyboard. */}
      <KeyboardRevealGroup style={styles.point} testID={`${testID}-group`}>
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
      </KeyboardRevealGroup>
    </View>
  );
}

type Props = {
  anchor?: ParcelAnchor;
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
export function ParcelRouteSection({ anchor, pickup, pickupIsGps, dropoff, near, pickupError, dropoffError, onPickup, onDropoff }: Props) {
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
        anchorRef={anchor?.('pickup')}
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
        anchorRef={anchor?.('dropoff')}
        testID="parcel-dropoff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  point: { gap: space[2] },
});
