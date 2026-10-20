import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Button, Icon, Skeleton } from '../../../components/ui';
import { componentTokens, radius, space } from '../../../theme';
import { readText } from '../../../core/api/read';
import { toast } from '../../../core/toast';
import type { RideResource } from '../../../services/rideService';
import { t } from '../../../i18n';
import { formatMoney, formatSignedMoney } from '../../../utils/format';
import { NOT_RATABLE, toRideRatingFields, toRideRatingState } from '../../rating/api';
import { useRatingForm, type RatingFormState } from '../../rating/components/RatingForm';
import { ReceiptRatingBlock } from '../../rating/components/ReceiptRating';
import type { RideRatingFields, RideRatingState } from '../../rating/types';
import { driverSplitOf } from '../../fare/api';
import { formatRate } from '../../fare/format';
import { lockedDistanceLabel, lockedTimeLabel } from '../../../components/ui/ride/FareBreakdown';
import { isParcelRide, parcelOf } from '../../parcel/api';
import { FARE_WAIT_MS } from '../../active-ride/trip/PassengerReceipt';
import { ACTIVE_RIDE_COPY } from '../../active-ride/copy';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import { DRIVER_RIDE_TOAST_OPTIONS } from '../hooks';
import { toRideSummary } from '../steps';
import { driverCancelledCopy, driverReceiptOf, riderNameOf, type DriverReceiptModel } from './driverTripModel';

const k = componentTokens.tripSheet;
/** DC1 footer: a failed rating is retried once from the footer, then the driver moves on. */
export const RATING_TRIES = 2;

export type DriverReceiptState = {
  model: DriverReceiptModel;
  form: RatingFormState | null;
  myStars: number | null;
  /** The footer: submit the chosen stars first, else (or after the retry) back to Drive. */
  onFooter: () => void;
};

/**
 * DC1 #6 + footer: the inline rating of the rider (shared RatingForm, T-505 stale handling). A
 * submitted or stale rating patches the ride kept in Redux; a submitted one returns to Drive.
 * Every failed submit is a toast; after RATING_TRIES failures the driver goes on regardless.
 */
export const useDriverReceipt = (
  ride: RideResource,
  { onRatingChange, onFinish, offline }: { onRatingChange: (rideId: number, fields: RideRatingFields) => void; onFinish: () => void; offline: boolean },
): DriverReceiptState => {
  const rideId = ride.id;
  const state = toRideRatingState(ride);
  const ratable = ride.status === 'completed' && state.canRate;
  const failures = useRef(0);
  const onRated = useCallback(
    (next: RideRatingState) => {
      onRatingChange(rideId, toRideRatingFields(next));
      onFinish();
    },
    [onFinish, onRatingChange, rideId],
  );
  const onStale = useCallback((next: RideRatingState | null) => onRatingChange(rideId, toRideRatingFields(next ?? NOT_RATABLE)), [onRatingChange, rideId]);
  const onFailed = useCallback(() => {
    failures.current += 1;
    toast.error(COPY.ratingFailed, undefined, DRIVER_RIDE_TOAST_OPTIONS);
    // The rating is not worth blocking the next ride.
    if (failures.current >= RATING_TRIES) onFinish();
  }, [onFinish]);
  const form = useRatingForm({ rideId, role: 'driver', parcel: isParcelRide(ride), enabled: ratable, onRated, onStale, onFailed });
  const shownForm = ratable ? form : null;
  const onFooter = useCallback(() => {
    if (shownForm && shownForm.stars > 0) {
      if (!offline) {
        shownForm.submit();
        return;
      }
      // DC3 offline: the driver still goes back to Drive, but is told the stars were not sent.
      toast.info(COPY.ratingNotSentOffline, undefined, DRIVER_RIDE_TOAST_OPTIONS);
    }
    onFinish();
  }, [offline, onFinish, shownForm]);
  return { model: driverReceiptOf(ride), form: shownForm, myStars: state.myRating?.stars ?? null, onFooter };
};

/** DC1 #3: "Collect from {name}" and the server total, the Cash badge; a skeleton until it is final. */
function MoneyCard({ model }: { model: DriverReceiptModel }) {
  const { theme } = useAppTheme();
  const [waited, setWaited] = useState(false);
  const waiting = model.total === null;
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setTimeout(() => setWaited(true), FARE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);
  const amount = model.total !== null ? formatMoney(model.total) : null;
  return (
    <View
      style={[styles.money, { backgroundColor: theme.colors.surfaceAlt }]}
      accessible
      accessibilityLabel={amount ? `${model.caption}, ${amount}` : `${model.caption}. ${COPY.fareLater}`}
      testID="driver-ride-money-card"
    >
      <View style={styles.moneyText}>
        <AppText variant="caption" color="textSecondary" testID="driver-ride-collect">
          {model.caption}
        </AppText>
        {amount ? (
          <AppText variant="numericXL" testID="driver-ride-total">
            {amount}
          </AppText>
        ) : waited ? (
          <AppText variant="bodySmall" color="textSecondary" testID="driver-ride-fare-later">
            {COPY.fareLater}
          </AppText>
        ) : (
          <Skeleton width={k.amountSkeletonWidth} height={k.amountSkeletonHeight} shape="block" testID="driver-ride-total-skeleton" />
        )}
      </View>
      {model.cash && !model.parcel ? <Badge label={COPY.cashBadge} tone="neutral" icon="cash" testID="driver-ride-cash-badge" /> : null}
    </View>
  );
}

type Row = { key: string; label: string; value: string; strong?: boolean; testID?: string };

/** The fare's parts and the BE-84 split, as the server computed them (moved from DriverRideSummary). */
const fareRows = (ride: RideResource): Row[] => {
  const summary = toRideSummary(ride);
  const b = summary.breakdown;
  const rows: Row[] = [];
  if (b) {
    const parts: Array<{ key: string; label: string; value: number | null }> = [
      { key: 'base', label: COPY.base, value: b.base },
      // T-557: a locked fare (BE-82) charged the quote's km and minutes, not the trip as driven.
      { key: 'distance', label: summary.fareLocked ? lockedDistanceLabel(summary.quotedDistanceKm) : COPY.distance, value: b.distance },
      { key: 'time', label: summary.fareLocked ? lockedTimeLabel(summary.quotedDurationMinutes) : COPY.time, value: b.time },
      { key: 'stops', label: COPY.stopsFare, value: b.stops },
      { key: 'min', label: COPY.minFareAdjustment, value: b.minFareAdjustment },
      { key: 'bookingFee', label: t('ride.fareBookingFee'), value: b.bookingFee },
      { key: 'waiting', label: t('ride.fareWaiting'), value: b.waiting },
    ];
    parts.forEach((p) => {
      if (p.value !== null && p.value > 0) rows.push({ key: p.key, label: p.label, value: formatMoney(p.value), testID: `driver-ride-breakdown-${p.key}` });
    });
    if (b.offerAdjustment !== null && b.offerAdjustment !== 0) {
      rows.push({ key: 'offer', label: t('ride.fareOffer'), value: formatSignedMoney(b.offerAdjustment), testID: 'driver-ride-breakdown-offer' });
    }
  }
  const split = driverSplitOf(ride);
  if (split) {
    if (split.bookingFee > 0) rows.push({ key: 'split-fee', label: t('driverFare.bookingFee'), value: formatMoney(-split.bookingFee), testID: 'driver-ride-split' });
    rows.push({ key: 'commission', label: t('driverFare.commission', { rate: formatRate(split.commissionRate) }), value: formatMoney(-Math.abs(split.commissionAmount)), testID: 'driver-ride-commission' });
  }
  if (summary.driverEarnings !== null && (split || rows.length > 0)) {
    rows.push({ key: 'net', label: COPY.youKeep, value: formatMoney(summary.driverEarnings), strong: true, testID: 'driver-ride-breakdown-net' });
  }
  return rows;
};

/** DC1 #5: "Fare details", collapsed at first; expands the rows in place. */
function FareDetails({ ride }: { ride: RideResource }) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const rows = fareRows(ride);
  if (rows.length === 0) return null;
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={ACTIVE_RIDE_COPY.fareDetails}
        style={styles.detailsRow}
        testID="driver-ride-fare-details"
      >
        <AppText variant="bodyStrong" style={styles.flex}>
          {ACTIVE_RIDE_COPY.fareDetails}
        </AppText>
        <View style={open ? styles.flipped : null}>
          <Icon name="chevronDown" size={k.chevron} color="textSecondary" />
        </View>
      </Pressable>
      {open ? (
        <View testID="driver-ride-breakdown">
          {rows.map((row) => (
            <View
              key={row.key}
              style={[styles.row, row.strong ? [styles.netRow, { borderTopColor: theme.colors.border }] : null]}
              testID={row.testID}
            >
              <AppText variant={row.strong ? 'bodyStrong' : 'bodySmall'} color={row.strong ? 'textPrimary' : 'textSecondary'} style={styles.flex}>
                {row.label}
              </AppText>
              <AppText variant={row.strong ? 'numeric' : 'numericSmall'}>{row.value}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** The receipt body (DC1 #3–#6): money card, You keep, Fare details, rating. */
export function DriverReceiptBody({ ride, receipt }: { ride: RideResource; receipt: DriverReceiptState }) {
  const { model } = receipt;
  const name = riderNameOf(ride) ?? (model.parcel ? COPY.senderFallback : COPY.passengerFallback);
  return (
    <View style={styles.body} testID="driver-ride-summary">
      <View style={styles.moneyGroup}>
        <MoneyCard model={model} />
        {model.net !== null ? (
          // DC1 #4: one start and end edge with Fare details below it (no row inset of its own).
          <View
            style={styles.youKeep}
            accessible
            accessibilityLabel={`${COPY.youKeep}, ${formatMoney(model.net)}${model.rate !== null ? `, ${COPY.afterCommission(model.rate)}` : ''}`}
            testID="driver-ride-you-keep"
          >
            <View style={styles.flex}>
              <AppText variant="title">{COPY.youKeep}</AppText>
              {model.rate !== null ? (
                <AppText variant="caption" color="textSecondary">
                  {COPY.afterCommission(model.rate)}
                </AppText>
              ) : null}
            </View>
            <AppText variant="numericL" testID="driver-ride-earnings">
              {formatMoney(model.net)}
            </AppText>
          </View>
        ) : null}
        <FareDetails ride={ride} />
      </View>
      <ReceiptRatingBlock
        name={name}
        photoUri={readText(ride.passenger?.profile_image_url)}
        title={model.parcel ? t('rating.titleParcel') : ACTIVE_RIDE_COPY.rateWith(name)}
        form={receipt.form}
        myStars={receipt.myStars}
        ratedLabel={ACTIVE_RIDE_COPY.youRated}
      />
    </View>
  );
}

/** DC1 footer: "Cash collected" (a cash ride) or "Done"; "Back to Drive" offline. */
export function DriverReceiptFooter({ receipt, offline }: { receipt: DriverReceiptState; offline: boolean }) {
  const { model, form } = receipt;
  const label = offline ? COPY.backToDrive : model.cash && !model.parcel ? COPY.cashCollected : COPY.done;
  return (
    <Button
      label={label}
      size="lg"
      haptic="impactLight"
      onPress={receipt.onFooter}
      loading={!!form?.submitting}
      testID="driver-ride-done"
    />
  );
}

/** DP6 "Passenger cancelled": the 64 icon circle, the centred title and "You're back online." */
export function DriverCancelledHeader({ ride }: { ride: RideResource }) {
  const { theme } = useAppTheme();
  const copy = driverCancelledCopy(ride, parcelOf(ride));
  return (
    <View style={styles.cancelled} testID="driver-ride-cancelled">
      <View style={[styles.circle, { backgroundColor: theme.colors.surfaceAlt }]}>
        <Icon name="riderCancelled" size={componentTokens.requestSheet.stateGlyph} color="textSecondary" />
      </View>
      <AppText variant="h3" align="center" accessibilityRole="header" accessibilityLiveRegion="polite" testID="driver-ride-cancelled-title">
        {copy.title}
      </AppText>
      <AppText variant="bodySmall" color="textSecondary" align="center" testID="driver-ride-cancelled-body">
        {copy.body}
      </AppText>
    </View>
  );
}

export function DriverCancelledFooter({ onDone }: { onDone: () => void }) {
  return <Button label={COPY.backToDrive} size="lg" onPress={onDone} testID="driver-ride-done" />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space[6] },
  moneyGroup: { gap: space[2] },
  money: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[4], borderRadius: radius.lg },
  moneyText: { flex: 1, minWidth: 0, gap: k.titleGap },
  youKeep: { flexDirection: 'row', alignItems: 'center', minHeight: componentTokens.listItem.minHeight.one, gap: space[3] },
  detailsRow: { flexDirection: 'row', alignItems: 'center', minHeight: k.detailsRowHeight, gap: space[2] },
  flipped: { transform: [{ rotate: '180deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: k.fareRowMinHeight, gap: space[3] },
  netRow: { marginTop: space[2], paddingTop: space[2], borderTopWidth: StyleSheet.hairlineWidth },
  cancelled: { alignItems: 'center', gap: space[2] },
  circle: {
    width: componentTokens.requestSheet.stateCircle,
    height: componentTokens.requestSheet.stateCircle,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
});
