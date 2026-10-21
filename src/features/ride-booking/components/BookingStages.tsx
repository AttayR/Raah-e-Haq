import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, Button, Icon, ListGroup, ListItem, OfflineBanner, useIsOffline } from '../../../components/ui';
import { t } from '../../../i18n';
import { KeyboardRevealGroup } from '../../../components/ui/keyboardReveal';
import { StopRow, StopSearch, stopTextStart } from '../../../components/passenger/StopsEditor';
import { componentTokens, radius, space } from '../../../theme';
import { BOOKING_COPY } from '../copy';
import { ChooseOnMapButton } from './MapPick';
import { SelectedFare, VehicleChoice, requestFareText } from './BookingChoices';
import { useSheetScrollLock } from './BookingSheet';
import type { BookingPlace } from '../buildRideRequest';
import { estimateFor, type useFareEstimates, type useVehicleTypes } from '../hooks';
import type { FareOffer } from '../../fare/hooks';
import type { FareNotice } from '../../fare/types';
import { FareNoticeBanner } from '../../fare/components/FareBits';
import type { VehicleOption } from '../vehicleOptions';
import { useBookingCooldownSeconds } from '../bookingCooldown';
import { formatCountdown } from '../../safety/pin';

type Coords = { latitude: number; longitude: number };

/**
 * Extra stops the booking UI allows. The server accepts up to 5; the UI caps at 3 to keep the
 * route card short (passenger-destination-search.md).
 */
export const MAX_STOPS = 3;

/** The trip's stop rows (T-553): a map-picked stop has no address until booking. */
export const tripCardStops = (stops: ReadonlyArray<BookingPlace>) =>
  stops.map((s, i) => ({
    key: i,
    address: (typeof s.address === 'string' && s.address.trim()) || BOOKING_COPY.pinnedOnMap,
    testID: `trip-details-stop-${i + 1}`,
  }));

/**
 * A place's short name (passenger-vehicle-fare.md block 3 [UI-R10]): the address up to its first
 * comma ("Liberty Market", not "Liberty Market, Gulberg III, Lahore"). Booking places carry no
 * separate name today, so the address is the source.
 */
export const shortPlace = (text: string): string => text.split(',')[0]?.trim() || text.trim();

/** "Liberty Market → Emporium Mall · 2 stops" (passenger-vehicle-fare.md block 3). */
export const tripLineText = (pickup: string, dropoff: string, stopCount: number): string =>
  [BOOKING_COPY.tripLine(shortPlace(pickup), shortPlace(dropoff)), stopCount > 0 ? BOOKING_COPY.stopsCount(stopCount) : null]
    .filter(Boolean)
    .join(' · ');

type StopsSectionProps = {
  stops: BookingPlace[];
  onAddStop: (c: Coords, address: string) => void;
  onRemoveStop: (index: number) => void;
  /** UI-R9b: drag (or a screen reader action) moved a stop; absent: no reorder. */
  onMoveStop?: (from: number, to: number) => void;
  onAddStopOnMap: () => void;
  onFocusChange?: (focused: boolean) => void;
};

/**
 * Stable keys for the stop rows (one per stop object), so a dragged row keeps its view and its
 * animation as it lands. ListGroup keys its own wrappers by position; these keys are the rows'.
 */
const useStopKeys = () => {
  const keys = useRef(new WeakMap<object, number>());
  const next = useRef(0);
  return (stop: object): number => {
    let key = keys.current.get(stop);
    if (key === undefined) {
      next.current += 1;
      key = next.current;
      keys.current.set(stop, key);
    }
    return key;
  };
};

/**
 * Stops as a sheet row (DESIGN_SYSTEM §9 v1.1, UI-R10): the stops on the trip and "Add a stop" in
 * one ListGroup (UI-R9b, UI-R10 polish), with remove and, from two stops, the drag handle that
 * reorders them; "Add a stop" opens the stop search and "Choose stop on map". T-556: while the
 * stop search is typed in, the sheet reveals this whole section, so the field and its
 * suggestions stay in view. A drag holds the sheet's scroll.
 */
export const StopsSection: React.FC<StopsSectionProps> = ({ stops, onAddStop, onRemoveStop, onMoveStop, onAddStopOnMap, onFocusChange }) => {
  const [adding, setAdding] = useState(false);
  const lockScroll = useSheetScrollLock();
  const keyOf = useStopKeys();
  const canAdd = stops.length < MAX_STOPS;
  const searching = adding && canAdd;
  const rows = stops.map((stop, index) => (
    <StopRow
      key={keyOf(stop)}
      stop={stop}
      index={index}
      count={stops.length}
      onRemove={onRemoveStop}
      onMove={onMoveStop}
      onDragChange={lockScroll}
      // UI-R9b review ruling: the divider under a stop row starts at its own text.
      dividerInset={stopTextStart(!!onMoveStop && stops.length > 1)}
    />
  ));
  return (
    <KeyboardRevealGroup style={styles.stops} testID="booking-stops-section">
      {rows.length > 0 || (!searching && canAdd) ? (
        <ListGroup testID="booking-stops-group">
          {rows}
          {!searching && canAdd ? (
            <ListItem
              icon="add"
              title={BOOKING_COPY.addStop}
              subtitle={BOOKING_COPY.addStopSubtitle(MAX_STOPS)}
              onPress={() => setAdding(true)}
              testID="add-stop-row"
            />
          ) : null}
        </ListGroup>
      ) : null}
      {searching ? (
        <>
          <StopSearch
            onAddStop={(c, address) => {
              onAddStop(c, address);
              setAdding(false);
            }}
            onFocusChange={onFocusChange}
          />
          <ChooseOnMapButton testID="add-stop-on-map" label={BOOKING_COPY.addStopOnMap} onPress={onAddStopOnMap} />
        </>
      ) : null}
    </KeyboardRevealGroup>
  );
};

/** Cash only (owner decision B-08): a fixed row, no picker. */
const PaymentRow: React.FC = () => (
  <ListGroup>
    <ListItem
      leading={<Icon name="cash" size={24} color="success" />}
      title={BOOKING_COPY.paymentCash}
      subtitle={BOOKING_COPY.paymentCashBody}
      testID="booking-payment-row"
    />
  </ListGroup>
);

type ChooseRideProps = {
  pickupLabel: string;
  dropoffLabel: string;
  stops: BookingPlace[];
  vehicleTypes: ReturnType<typeof useVehicleTypes>;
  estimates: ReturnType<typeof useFareEstimates>;
  options: ReadonlyArray<VehicleOption>;
  selectedVehicle: string | undefined;
  onSelectVehicle: (id: string) => void;
  /** BE-83 "Offer your fare" for the selected quote. */
  offer?: FareOffer;
  /** BE-60 fuel notice from the vehicle catalogue, used when the estimate carries none. */
  catalogueNotice?: FareNotice | null;
  /** Back to the search to change the trip. */
  onEditTrip: () => void;
  /** BE-87 "Female driver"; nothing when the passenger may not ask. */
  preferences?: React.ReactNode;
  /** The stops row (StopsSection), once both ends are set. */
  stopsSection?: React.ReactNode;
  /** Start with Fare details expanded (Debug gallery evidence). */
  fareDetailsOpen?: boolean;
  /** Show the offline state regardless of NetInfo (Debug gallery evidence only). */
  forceOffline?: boolean;
};

/**
 * "Choose a ride" (passenger-vehicle-fare.md, DS §12.5, UI-R10): one sheet state instead of the
 * old vehicle and fare steps. Title, the trip on one line (tap to edit), the fuel notice, the tier
 * list, the selected tier's fare inline, ride preferences, stops and the cash row. The request
 * itself is the sheet footer (`ChooseRideFooter`).
 */
export const ChooseRideStage: React.FC<ChooseRideProps> = (p) => {
  const { theme } = useAppTheme();
  const trip = tripLineText(p.pickupLabel, p.dropoffLabel, p.stops.length);
  const stopsSuffix = p.stops.length > 0 ? ` · ${BOOKING_COPY.stopsCount(p.stops.length)}` : null;
  const route = p.estimates.data;
  const quote = estimateFor(route, p.selectedVehicle);
  return (
    <View style={styles.stack} testID="choose-ride">
      {p.forceOffline ? <Banner tone="warning" icon="offline" text={t('kit.offline')} testID="offline-banner" /> : <OfflineBanner />}
      <View style={styles.header}>
        <AppText variant="h2" accessibilityRole="header" testID="choose-ride-title">
          {BOOKING_COPY.chooseRideTitle}
        </AppText>
        <Pressable
          onPress={p.onEditTrip}
          accessibilityRole="button"
          accessibilityLabel={BOOKING_COPY.editTripA11y(trip)}
          android_ripple={{ color: theme.colors.surfacePressed }}
          style={({ pressed }) => [styles.tripRow, pressed ? { backgroundColor: theme.colors.surfacePressed } : null]}
          testID="trip-details"
        >
          {/* The drop-off truncates; the stop count never does. */}
          <View style={styles.tripText} testID="trip-details-line" accessibilityLabel={trip}>
            <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.shrink}>
              {BOOKING_COPY.tripLine(shortPlace(p.pickupLabel), shortPlace(p.dropoffLabel))}
            </AppText>
            {stopsSuffix ? (
              <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {stopsSuffix}
              </AppText>
            ) : null}
          </View>
          <Icon name="edit" size={16} color="textSecondary" />
        </Pressable>
      </View>
      <FareNoticeBanner notice={route?.fare_notice ?? p.catalogueNotice ?? null} />
      <VehicleChoice
        vehicleTypes={p.vehicleTypes}
        estimates={p.estimates}
        options={p.options}
        selectedId={p.selectedVehicle}
        onSelect={p.onSelectVehicle}
      />
      {quote && route ? (
        <SelectedFare
          quote={quote}
          distanceKm={route.distance_km}
          durationMin={route.duration_min}
          offer={p.offer}
          defaultOpen={p.fareDetailsOpen}
        />
      ) : null}
      {p.preferences}
      {p.stopsSection}
      <PaymentRow />
    </View>
  );
};

type FooterProps = {
  options: ReadonlyArray<VehicleOption>;
  estimates: ReturnType<typeof useFareEstimates>;
  selectedVehicle: string | undefined;
  offer?: FareOffer;
  onConfirm: () => void;
  /** T-574: the tap is being handled: the button shows its loading state at once. */
  confirming?: boolean;
  /** A request is already being sent: nothing more can be requested (UI-R10). */
  disabled?: boolean;
  /** Show the offline state regardless of NetInfo (Debug gallery evidence only). */
  forceOffline?: boolean;
};

/**
 * The choose-ride sheet's one primary action, pinned in the footer (§12.2 map archetype):
 * "Request {tier} · {fare}" (§12.5 [UI-R5]) with the server's tier name and the offer (else the
 * quote). Disabled "Request" until the selected tier is priced, and "Request again in m:ss" while
 * a BOOKING_COOLDOWN runs. Haptic `impactLight` (§6.11).
 */
export const ChooseRideFooter: React.FC<FooterProps> = ({
  options,
  estimates,
  selectedVehicle,
  offer,
  onConfirm,
  confirming = false,
  disabled = false,
  forceOffline = false,
}) => {
  const offline = useIsOffline() || forceOffline;
  // BOOKING_COOLDOWN: held with a countdown; this button is the only thing that re-renders each second.
  const cooldown = useBookingCooldownSeconds();
  const option = useMemo(() => options.find((o) => o.id === selectedVehicle) ?? null, [options, selectedVehicle]);
  const quote = estimateFor(estimates.data, selectedVehicle);
  const fare = requestFareText(quote, offer);
  const ready = !!option && !!fare && !option.unavailable;
  const label = offline
    ? BOOKING_COPY.requestOffline
    : cooldown > 0
      ? BOOKING_COPY.requestCooldown(formatCountdown(cooldown))
      : ready && option && fare
        ? BOOKING_COPY.requestWithFare(option.name, fare)
        : BOOKING_COPY.requestIdle;
  return (
    <Button
      label={label}
      size="lg"
      haptic="impactLight"
      onPress={onConfirm}
      disabled={!ready || offline || disabled || cooldown > 0}
      loading={confirming}
      testID="fare-request"
    />
  );
};

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  header: { gap: space[1] },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: componentTokens.iconButton.target,
    marginHorizontal: -space[2],
    paddingHorizontal: space[2],
    borderRadius: radius.sm,
  },
  tripText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  shrink: { flexShrink: 1, minWidth: 0 },
  stops: { gap: space[2] },
});
