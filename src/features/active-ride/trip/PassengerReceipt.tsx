import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, FareBreakdown, FareTag, Icon, Skeleton } from '../../../components/ui';
import { componentTokens, radius, space } from '../../../theme';
import { readNumberOrNull } from '../../../core/api/read';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { formatMoney } from '../../../utils/format';
import { NOT_RATABLE, toRideRatingFields, toRideRatingState } from '../../rating/api';
import { useRatingForm, type RatingFormState } from '../../rating/components/RatingForm';
import { ReceiptRatingBlock } from '../../rating/components/ReceiptRating';
import type { RideRatingFields, RideRatingState } from '../../rating/types';
import { isParcelRide } from '../../parcel/api';
import { toRide } from '../../ride-history/api';
import { tripPrefillOf, type SupportRoutes } from '../../support/navigation';
import type { RideResource } from '../../../services/rideService';
import { ACTIVE_RIDE_COPY } from '../copy';
import { driverCardOf, fareSummaryOf } from '../stage';
import type { PassengerTripView } from './usePassengerTripView';

const k = componentTokens.tripSheet;
/** PR5: how long the receipt waits for the server's final fare before saying where it will be. */
export const FARE_WAIT_MS = 10_000;

export type ReceiptRating = {
  /** Patch the ride kept in Redux with the new `my_rating` / `can_rate`. */
  onRatingChange: (rideId: number, fields: RideRatingFields) => void;
};

export type PassengerReceiptState = {
  form: RatingFormState | null;
  canRate: boolean;
  myStars: number | null;
};

/**
 * The receipt's rating (PR2 block 5, PR5): one RatingForm when the ride can still be rated; a
 * submitted rating thanks the passenger and patches the ride (the host then goes Home); a stale
 * answer shows the server's `my_rating`.
 */
export const usePassengerReceipt = (
  view: PassengerTripView,
  rating: ReceiptRating | null,
  onFinish: () => void,
): PassengerReceiptState => {
  const ride = view.ride;
  const rideId = ride?.id ?? 0;
  const state = toRideRatingState(ride);
  const ratable = !!rating && !!ride && view.stage === 'completed' && state.canRate;
  const onRated = useCallback(
    (next: RideRatingState) => {
      toast.success(ACTIVE_RIDE_COPY.ratingThanks);
      rating?.onRatingChange(rideId, toRideRatingFields(next));
      onFinish();
    },
    [onFinish, rating, rideId],
  );
  const onStale = useCallback(
    (next: RideRatingState | null) => rating?.onRatingChange(rideId, toRideRatingFields(next ?? NOT_RATABLE)),
    [rating, rideId],
  );
  // PR5: every failed submit is a toast (also the same failure twice); the stars, tags and comment stay.
  const onFailed = useCallback(() => toast.error(ACTIVE_RIDE_COPY.ratingFailed), []);
  const form = useRatingForm({ rideId, role: 'passenger', parcel: isParcelRide(ride), enabled: ratable, onRated, onStale, onFailed });
  return { form: ratable ? form : null, canRate: ratable, myStars: state.myRating?.stars ?? null };
};

/** The money card is drawn: always on a completed ride; on a cancelled one only with a fee. */
export const hasReceiptMoneyCard = (view: Pick<PassengerTripView, 'stage' | 'ride'>): boolean => {
  if (view.stage !== 'cancelled') return true;
  const fee = readNumberOrNull(view.ride?.cancellation_fee);
  return fee !== null && fee > 0;
};

/** "Fare details" is drawn: a completed ride with the server's fare summary. */
export const hasReceiptFareDetails = (view: Pick<PassengerTripView, 'stage' | 'ride'>): boolean =>
  !!view.ride && view.stage === 'completed' && fareSummaryOf(view.ride) !== null;

/** "Pay your driver in cash" + the final total, FareTag when fixed (PR2 block 3); skeleton while not final. */
function MoneyCard({ view }: { view: PassengerTripView }) {
  const { theme } = useAppTheme();
  const ride = view.ride;
  const cancelled = view.stage === 'cancelled';
  const fee = cancelled ? readNumberOrNull(ride?.cancellation_fee) : null;
  const total = cancelled ? fee : readNumberOrNull(ride?.total_fare);
  const [waited, setWaited] = useState(false);
  const waiting = !cancelled && total === null;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setWaited(true), FARE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  if (cancelled && (fee === null || fee <= 0)) return null;
  const caption = cancelled
    ? ACTIVE_RIDE_COPY.cancellationFee
    : view.parcel
      ? t('parcel.senderPaidAtPickup')
      : ACTIVE_RIDE_COPY.payDriverCash;
  const amount = total !== null ? formatMoney(total) : null;
  return (
    <View
      style={[styles.money, { backgroundColor: theme.colors.surfaceAlt }]}
      accessible
      accessibilityLabel={amount ? ACTIVE_RIDE_COPY.moneyA11y(caption, amount, view.fixed && !cancelled) : `${caption}. ${ACTIVE_RIDE_COPY.fareLater}`}
      testID="ride-fare-summary"
    >
      <View style={styles.moneyText}>
        <AppText variant="caption" color="textSecondary">
          {caption}
        </AppText>
        {amount ? (
          <AppText variant={cancelled ? 'numericL' : 'numericXL'} testID="receipt-amount">
            {amount}
          </AppText>
        ) : waited ? (
          <AppText variant="bodySmall" color="textSecondary" testID="receipt-fare-later">
            {ACTIVE_RIDE_COPY.fareLater}
          </AppText>
        ) : (
          <Skeleton width={k.amountSkeletonWidth} height={k.amountSkeletonHeight} shape="block" testID="receipt-amount-skeleton" />
        )}
      </View>
      {view.fixed && !cancelled ? <FareTag kind="fixed" testID="receipt-fare-tag" /> : null}
    </View>
  );
}

/** "Fare details" (PR2 block 4): expands the shipped FareBreakdown in place, collapsed at first. */
function FareDetails({ view }: { view: PassengerTripView }) {
  const [open, setOpen] = useState(false);
  const ride = view.ride;
  const fare = ride && view.stage === 'completed' ? fareSummaryOf(ride) : null;
  if (!ride || !fare) return null;
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={ACTIVE_RIDE_COPY.fareDetails}
        style={styles.detailsRow}
        testID="receipt-fare-details"
      >
        <AppText variant="bodyStrong" style={styles.flex}>
          {ACTIVE_RIDE_COPY.fareDetails}
        </AppText>
        <View style={open ? styles.flipped : null}>
          <Icon name="chevronDown" size={k.chevron} color="textSecondary" />
        </View>
      </Pressable>
      {open ? (
        <FareBreakdown
          testID="ride-fare-breakdown"
          breakdown={fare.breakdown}
          total={fare.total}
          distanceKm={ride.distance_km ?? null}
          durationMin={ride.duration_minutes ?? null}
          fareLocked={ride.fare_locked === true}
          quotedDistanceKm={readNumberOrNull(ride.quoted_distance_km)}
          quotedDurationMin={readNumberOrNull(ride.quoted_duration_minutes)}
          totalLabel={ACTIVE_RIDE_COPY.finalFareLabel}
          // The money card above already says how to pay: no repeated footnote here.
          footnote={null}
        />
      ) : null}
    </View>
  );
}

/** PR2 block 5 / 5': rate the driver inline, or the stars already given (shared ReceiptRating). */
function RatingBlock({ view, receipt }: { view: PassengerTripView; receipt: PassengerReceiptState }) {
  const ride = view.ride;
  if (!ride || view.stage !== 'completed') return null;
  const card = driverCardOf(ride);
  const name = card.name ?? ACTIVE_RIDE_COPY.driverFallbackName;
  return (
    <ReceiptRatingBlock
      name={name}
      photoUri={card.photoUri}
      title={view.parcel ? t('rating.titleParcel') : ACTIVE_RIDE_COPY.rateWith(name)}
      form={receipt.form}
      myStars={receipt.myStars}
      ratedLabel={ACTIVE_RIDE_COPY.youRated}
    />
  );
}

/** Anything that can open a new support request: a screen's `navigation` inside a role stack. */
type SupportNewRequestNavigator = { navigate(name: 'SupportNewRequest', params: SupportRoutes['SupportNewRequest']): void };

/**
 * passenger-trip-complete §7 / shared-support-invite (routes): ghost `sm` "Get help with this
 * ride" → SupportNewRequest with this ride as the trip, on a completed or cancelled receipt.
 * Pushing the request keeps the booking screen (and any sheet it owns) mounted underneath (T-565).
 * Hidden outside a navigator (the gallery) and for a ride without a usable id.
 */
export function ReceiptHelp({ ride }: { ride: RideResource | null }) {
  const navigation: SupportNewRequestNavigator | undefined = useContext(NavigationContext);
  const trip = useMemo(() => {
    const parsed = ride ? toRide(ride) : null;
    return parsed ? tripPrefillOf(parsed) : null;
  }, [ride]);
  if (!navigation || !trip) return null;
  return (
    <View style={styles.help}>
      <Button
        label={t('support.rideHelpRow')}
        variant="ghost"
        size="sm"
        leadingIcon="support"
        fullWidth={false}
        flushStart
        onPress={() => navigation.navigate('SupportNewRequest', { trip })}
        testID="receipt-help"
      />
    </View>
  );
}

/** The receipt body (PR2): money card, Fare details, rating, help (the sheet's extras slot follows). */
export function PassengerReceiptBody({ view, receipt }: { view: PassengerTripView; receipt: PassengerReceiptState }) {
  return (
    <View style={styles.body} testID={`active-ride-${view.stage}`}>
      {/* [UI-R12 r2] An empty group would still take the body's 24 gap (a cancelled ride without a fee). */}
      {hasReceiptMoneyCard(view) || hasReceiptFareDetails(view) ? (
        <View style={styles.moneyGroup} testID="receipt-money-group">
          <MoneyCard view={view} />
          <FareDetails view={view} />
        </View>
      ) : null}
      <RatingBlock view={view} receipt={receipt} />
      <ReceiptHelp ride={view.ride} />
    </View>
  );
}

/** PR2 footer: "Submit rating" once a star is chosen (stars lock while sending), else "Done". */
export function PassengerReceiptFooter({ receipt, offline, onDone }: { receipt: PassengerReceiptState; offline: boolean; onDone: () => void }) {
  const form = receipt.form;
  if (form && form.stars > 0) {
    return (
      <Button
        label={offline ? ACTIVE_RIDE_COPY.offlineAction : ACTIVE_RIDE_COPY.submitRating}
        size="lg"
        haptic="impactLight"
        onPress={form.submit}
        disabled={offline}
        loading={form.submitting}
        testID="rate-ride-submit"
      />
    );
  }
  return <Button label={ACTIVE_RIDE_COPY.receiptDone} size="lg" onPress={onDone} testID="active-ride-done" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space[6] },
  moneyGroup: { gap: space[2] },
  money: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[4], borderRadius: radius.lg },
  moneyText: { flex: 1, minWidth: 0, gap: k.titleGap },
  detailsRow: { flexDirection: 'row', alignItems: 'center', minHeight: k.detailsRowHeight, gap: space[2] },
  flipped: { transform: [{ rotate: '180deg' }] },
  // UI-R19 review: the hugging ghost's glyph on the 16 gutter (flushStart), never centred.
  help: { alignItems: 'flex-start' },
});
