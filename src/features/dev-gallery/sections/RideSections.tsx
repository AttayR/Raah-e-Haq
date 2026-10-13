import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import SafeMapView from '../../../components/SafeMapView';
import {
  AddressPair,
  AppText,
  CarMarker,
  CarMarkerGlyph,
  FareBreakdown,
  IndeterminateBar,
  PersonCard,
  PinGlyph,
  RatingDisplay,
  RatingInput,
  RideMarker,
  RideProgress,
  RideStatusPill,
  RideTimeline,
  RouteLine,
  SearchingPulse,
  SlideToConfirm,
  VehicleOptionCard,
  VehicleOptionSkeleton,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { formatDateTime, timelineSteps } from '../../ride-history/format';
import { RIDE_HISTORY_COPY } from '../../ride-history/copy';
import { DRIVER_REQUESTS_COPY } from '../../driver-requests/copy';
import {
  galleryAssignedCar,
  galleryEstimates,
  galleryNearbyCars,
  galleryRegion,
  galleryRequest,
  galleryRide,
  galleryRoute,
  galleryStop,
  galleryVehicleOptions,
} from '../fixtures/rideFixtures';
import { GallerySection } from './GallerySection';

const noop = () => {};
/** A map frame tall enough to read the pins and route on an SE screen. */
const MAP_FRAME_HEIGHT = 420;

function Caption({ children }: { children: string }) {
  return (
    <AppText variant="overline" color="textMuted">
      {children}
    </AppText>
  );
}

/** §9 map style + §5.21 pins, cased route (traveled part grey), assigned and nearby cars. */
export function RideMapSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionRideMap')} hint={t('kitGallery.rideMapHint')} testID="gallery-ride-map">
      <View style={[styles.map, { borderColor: theme.colors.border }]}>
        <SafeMapView style={StyleSheet.absoluteFill} initialRegion={galleryRegion} customMapStyle={theme.mapStyle}>
          <RouteLine coordinates={galleryRoute.slice(2)} traveled={galleryRoute.slice(0, 3)} />
          <RideMarker kind="pickup" coordinate={galleryRoute[0]} label={t('ride.pickup')} />
          <RideMarker kind="stop" index={1} coordinate={galleryStop} />
          <RideMarker kind="dropoff" coordinate={galleryRoute[galleryRoute.length - 1]} />
          <CarMarker coordinate={galleryAssignedCar.coordinate} title={t('ride.driverMarker')} />
          {galleryNearbyCars.map(car => (
            <CarMarker key={car.id} coordinate={car.coordinate} muted title={t('ride.nearbyDriverMarker')} />
          ))}
        </SafeMapView>
      </View>
    </GallerySection>
  );
}

/** Pin glyphs, car badges and the searching pulse on a map-land coloured tile. */
export function RidePinsSection() {
  const { theme } = useAppTheme();
  const [requesting, setRequesting] = useState(true);
  return (
    <GallerySection title={t('kitGallery.sectionRidePins')} hint={t('kitGallery.ridePinsHint')} testID="gallery-ride-pins">
      <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
        <PinGlyph kind="pickup" />
        <PinGlyph kind="dropoff" />
        <PinGlyph kind="stop" index={1} />
        <CarMarkerGlyph />
        <CarMarkerGlyph muted />
      </View>
      <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
        <SearchingPulse />
      </View>
      <Caption>{t('kitGallery.rideSearching')}</Caption>
      <View style={[styles.sheetTop, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {requesting ? <IndeterminateBar /> : null}
        <AppText variant="h3" style={styles.sheetTitle} onPress={() => setRequesting(r => !r)}>
          {t('ride.searchingA11y')}
        </AppText>
      </View>
    </GallerySection>
  );
}

export function RideAddressSection() {
  const r = galleryRide;
  return (
    <GallerySection title={t('kitGallery.sectionRideAddress')} testID="gallery-ride-address">
      <Caption>{t('kitGallery.rideAddressRegular')}</Caption>
      <AddressPair labels dividers pickup={r.pickupAddress} dropoff={r.dropoffAddress} stops={r.stops.map(s => ({ key: s.id, address: s.address }))} />
      <Caption>{t('kitGallery.rideAddressCompact')}</Caption>
      <AddressPair density="compact" pickup={r.pickupAddress} dropoff={r.dropoffAddress} />
      <Caption>{t('kitGallery.rideAddressDriving')}</Caption>
      <AddressPair size="lg" labels numberOfLines={2} pickup={r.pickupAddress} dropoff={r.dropoffAddress} />
    </GallerySection>
  );
}

export function RideVehiclesSection() {
  const [selected, setSelected] = useState<string>('rickshaw');
  return (
    <GallerySection title={t('kitGallery.sectionRideVehicles')} hint={t('kitGallery.rideVehiclesHint')} testID="gallery-ride-vehicles">
      <View style={styles.list}>
        {galleryVehicleOptions.map(o => (
          <VehicleOptionCard
            key={o.id}
            vehicleKey={o.id}
            name={o.name}
            meta={o.meta}
            fare={o.fare}
            unavailable={o.unavailable}
            selected={selected === o.id}
            onPress={() => setSelected(o.id)}
          />
        ))}
      </View>
      <Caption>{t('kitGallery.rideVehiclesLoading')}</Caption>
      <VehicleOptionSkeleton />
    </GallerySection>
  );
}

export function RideFareSection() {
  const quote = galleryEstimates.estimates[0];
  const r = galleryRide;
  const b = r.fareBreakdown;
  return (
    <GallerySection title={t('kitGallery.sectionRideFare')} testID="gallery-ride-fare">
      <Caption>{t('kitGallery.rideFareEstimate')}</Caption>
      <FareBreakdown
        breakdown={{ ...quote.breakdown, minFareAdjustment: quote.breakdown.min_fare_adjustment }}
        total={quote.fare}
        currency={quote.currency}
        distanceKm={galleryEstimates.distance_km}
        durationMin={galleryEstimates.duration_min}
        footnote={t('ride.fareFootnote')}
      />
      <Caption>{t('kitGallery.rideFareReceipt')}</Caption>
      <FareBreakdown
        breakdown={b ? { base: b.base, distance: b.distance, time: b.time, stops: b.stops, minFareAdjustment: b.minFareAdjustment } : null}
        total={r.totalFare}
        distanceKm={r.distanceKm}
        durationMin={r.durationMinutes}
        extraRows={[
          { key: 'fee', label: RIDE_HISTORY_COPY.platformFee, value: formatMoney(-(r.platformCommission ?? 0)) },
          { key: 'earned', label: RIDE_HISTORY_COPY.youEarned, value: formatMoney(r.driverEarnings), strong: true },
        ]}
      />
    </GallerySection>
  );
}

export function RidePersonSection() {
  const r = galleryRide;
  const v = r.vehicle;
  const req = galleryRequest;
  return (
    <GallerySection title={t('kitGallery.sectionRidePerson')} testID="gallery-ride-person">
      <Caption>{t('kitGallery.ridePersonDriver')}</Caption>
      <PersonCard
        name={r.driver?.firstName}
        fallbackName={t('ride.driverMarker')}
        rating={r.driver?.rating}
        vehicleLine={v ? `${v.make} ${v.model} · ${v.color}` : null}
        plate={v?.licensePlate}
        plateHighlighted
        actions={[
          { key: 'call', icon: 'phone', label: t('ride.call'), onPress: noop },
          { key: 'message', icon: 'chat', label: t('ride.message'), onPress: noop, badgeCount: 2 },
        ]}
      />
      <Caption>{t('kitGallery.ridePersonPassenger')}</Caption>
      <PersonCard
        name={req?.passengerFirstName}
        fallbackName={DRIVER_REQUESTS_COPY.passengerFallback}
        rating={req?.passengerRating}
        newRatingLabel={DRIVER_REQUESTS_COPY.noRating}
        actions={[
          { key: 'call', icon: 'phone', label: t('ride.call'), onPress: noop },
          { key: 'message', icon: 'chat', label: t('ride.message'), onPress: noop },
          { key: 'navigate', icon: 'navigate', label: t('ride.navigate'), onPress: noop },
        ]}
      />
    </GallerySection>
  );
}

const STATUSES = ['requested', 'accepted', 'arrived', 'ongoing', 'completed', 'cancelled'];

export function RideProgressSection() {
  return (
    <GallerySection title={t('kitGallery.sectionRideProgress')} testID="gallery-ride-progress">
      {[0, 1, 2, 3].map(step => (
        <RideProgress key={step} step={step} />
      ))}
      <View style={styles.pills}>
        {STATUSES.map(status => (
          <RideStatusPill key={status} status={status} />
        ))}
      </View>
      <RideTimeline
        entries={timelineSteps(galleryRide).map(step => ({ key: step.key, label: step.label, time: formatDateTime(step.at) }))}
      />
    </GallerySection>
  );
}

export function RideRatingSection() {
  const [stars, setStars] = useState(4);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [loading]);
  return (
    <GallerySection title={t('kitGallery.sectionRideRating')} testID="gallery-ride-rating">
      <Caption>{t('kitGallery.rideRatingDisplay')}</Caption>
      <View style={styles.pills}>
        <RatingDisplay rating={galleryRide.driver?.rating} />
        <RatingDisplay rating={null} />
        <RatingDisplay rating={null} newLabel={DRIVER_REQUESTS_COPY.noRating} />
      </View>
      <Caption>{t('kitGallery.rideRatingInput')}</Caption>
      <RatingInput value={stars} onChange={setStars} />
      <Caption>{t('kitGallery.rideSlide')}</Caption>
      <SlideToConfirm label={t('kitGallery.rideSlide')} loading={loading} onConfirm={() => setLoading(true)} />
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  map: { height: MAP_FRAME_HEIGHT, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderRadius: radius.lg,
    paddingVertical: space[4],
  },
  sheetTop: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  sheetTitle: { padding: space[4] },
  list: { gap: space[2] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
});
