import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Button, FareBreakdown, FareTag, Icon, Skeleton } from '../../../components/ui';
import { componentTokens, radius, space } from '../../../theme';
import { readNumberOrNull } from '../../../core/api/read';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { formatMoney } from '../../../utils/format';
import { NOT_RATABLE, toRideRatingFields, toRideRatingState } from '../../rating/api';
import { RatingForm, useRatingForm, type RatingFormState } from '../../rating/components/RatingForm';
import type { RideRatingFields, RideRatingState } from '../../rating/types';
import { isParcelRide } from '../../parcel/api';
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

/** PR2 block 5 / 5': rate the driver inline, or the stars already given. */
function RatingBlock({ view, receipt }: { view: PassengerTripView; receipt: PassengerReceiptState }) {
  const ride = view.ride;
  if (!ride || view.stage !== 'completed') return null;
  if (receipt.form) {
    const card = driverCardOf(ride);
    const name = card.name ?? ACTIVE_RIDE_COPY.driverFallbackName;
    return (
      <View style={styles.rating} testID="receipt-rating">
        <Avatar name={name} uri={card.photoUri} size={componentTokens.ride.person.avatar} />
        <AppText variant="h3" align="center" numberOfLines={2} accessibilityRole="header">
          {view.parcel ? t('rating.titleParcel') : ACTIVE_RIDE_COPY.rateWith(name)}
        </AppText>
        <View style={styles.ratingForm}>
          <RatingForm form={receipt.form} tagVariant="outline" />
        </View>
      </View>
    );
  }
  if (receipt.myStars !== null) {
    const stars = receipt.myStars;
    return (
      <View style={styles.rated} accessible accessibilityLabel={t('rating.yourRatingA11y', { n: stars })} testID="receipt-rated">
        <View style={styles.starsRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <Icon key={i} name={i < stars ? 'star' : 'starOutline'} size={24} color={i < stars ? 'ratingStar' : 'borderStrong'} />
          ))}
        </View>
        <AppText variant="bodySmall" color="textSecondary" align="center">
          {ACTIVE_RIDE_COPY.youRated}
        </AppText>
      </View>
    );
  }
  return null;
}

/** The receipt body (PR2): money card, Fare details, rating (the sheet's extras slot follows). */
export function PassengerReceiptBody({ view, receipt }: { view: PassengerTripView; receipt: PassengerReceiptState }) {
  return (
    <View style={styles.body} testID={`active-ride-${view.stage}`}>
      <View style={styles.moneyGroup}>
        <MoneyCard view={view} />
        <FareDetails view={view} />
      </View>
      <RatingBlock view={view} receipt={receipt} />
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
  rating: { alignItems: 'center', gap: space[3] },
  ratingForm: { alignSelf: 'stretch', marginTop: space[1] },
  rated: { alignItems: 'center', gap: space[2] },
  starsRow: { flexDirection: 'row', gap: space[1] },
});
