import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, FareBreakdown, VehicleOptionCard, VehicleOptionSkeleton } from '../../../components/ui';
import { formatDistance, formatDuration } from '../../../utils/format';
import type { FareEstimates, VehicleType } from '../api';
import type { LoadStatus } from '../hooks';
import { estimateFor } from '../hooks';
import { BOOKING_COPY } from '../copy';
import { space } from '../../../theme';
import { formatFare, quoteBreakdown, rideVehicleTypes, toVehicleOptions } from '../vehicleOptions';
import { t } from '../../../i18n';
import { FareNoticeBanner, FarePolicyNote } from '../../fare/components/FareBits';
import { OfferStepper } from '../../fare/components/OfferStepper';
import type { FareOffer } from '../../fare/hooks';
import { offerDifference } from '../../fare/offer';
import type { FareNotice } from '../../fare/types';

type StatusLineProps = { status: 'loading' | 'error' | 'empty'; text: string; onRetry?: () => void };

/** One loading / error (with Retry) / empty line, on the kit (UI-R5). */
export const BookingStatusLine: React.FC<StatusLineProps> = ({ status, text, onRetry }) => {
  const { theme } = useAppTheme();
  return (
    <View testID={`booking-status-${status}`} accessibilityLiveRegion="polite" style={styles.row}>
      {status === 'loading' && <ActivityIndicator size="small" color={theme.colors.primaryText} />}
      <AppText variant="bodySmall" color={status === 'error' ? 'danger' : 'textSecondary'} style={styles.text}>
        {text}
      </AppText>
      {status === 'error' && onRetry && (
        <Button label={BOOKING_COPY.retry} variant="ghost" size="sm" fullWidth={false} onPress={onRetry} />
      )}
    </View>
  );
};

type Loaded<T> = { status: LoadStatus; data: T | null; error: string | null; retry: () => void };

type VehicleChoiceProps = {
  vehicleTypes: Loaded<VehicleType[]>;
  estimates: Loaded<FareEstimates>;
  selectedId?: string;
  onSelect: (key: string) => void;
};

/**
 * The vehicle list from GET /public/vehicle-types, priced by one POST /rides/estimate, as kit
 * VehicleOptionCards (UI-R5, §5.25: MDI glyphs, no emoji). Skeleton while the catalogue loads,
 * error (Retry) and empty states; a type can only be picked once priced.
 */
export const VehicleChoice: React.FC<VehicleChoiceProps> = ({ vehicleTypes, estimates, selectedId, onSelect }) => {
  if (vehicleTypes.status === 'loading' || vehicleTypes.status === 'idle') {
    return (
      <View style={styles.list}>
        <BookingStatusLine status="loading" text={BOOKING_COPY.vehicleTypesLoading} />
        <VehicleOptionSkeleton testID="vehicle-options-loading" />
      </View>
    );
  }
  if (vehicleTypes.status === 'error') {
    return (
      <BookingStatusLine
        status="error"
        text={vehicleTypes.error ?? BOOKING_COPY.vehicleTypesFailed}
        onRetry={vehicleTypes.retry}
      />
    );
  }
  // BE-88: only the ride tiers (the parcel tier has its own "Send a parcel" form).
  const types = rideVehicleTypes(vehicleTypes.data ?? []);
  if (types.length === 0) {
    return <BookingStatusLine status="empty" text={BOOKING_COPY.vehicleTypesEmpty} />;
  }
  return (
    <View style={styles.list}>
      {estimates.status === 'loading' && <BookingStatusLine status="loading" text={BOOKING_COPY.estimateLoading} />}
      {estimates.status === 'error' && (
        <BookingStatusLine
          status="error"
          text={estimates.error ?? BOOKING_COPY.estimateFailed}
          onRetry={estimates.retry}
        />
      )}
      {toVehicleOptions(types, estimates.data).map((option) => (
        <VehicleOptionCard
          key={option.id}
          vehicleKey={option.id}
          name={option.name}
          meta={option.meta}
          fare={option.fare}
          unavailable={option.unavailable}
          ac={option.ac}
          selected={selectedId === option.id}
          onPress={() => {
            if (estimateFor(estimates.data, option.id)) onSelect(option.id);
          }}
          testID={`vehicle-option-${option.id}`}
        />
      ))}
    </View>
  );
};

type FareReviewProps = {
  vehicleType: VehicleType | null;
  estimates: Loaded<FareEstimates>;
  onConfirm: () => void;
  /** T-574: the Request tap is being handled: the button shows its loading state at once. */
  confirming?: boolean;
  /** BE-83: the passenger's offer for this quote (the stepper renders only with a band). */
  offer?: FareOffer;
  /** BE-60: the vehicle catalogue's fuel notice, used when the estimate carries none. */
  catalogueNotice?: FareNotice | null;
};

/**
 * The selected type's server quote (BE-05) as a money hero and the kit FareBreakdown (§5.26), with
 * one primary "Request {vehicle}" (no emoji), or the quote's loading/error state. T-521: the fuel
 * notice, "Offer your fare" inside the band (the hero and total follow the offer) and, while fees
 * are on, the waiting and cancel terms.
 */
export const FareReview: React.FC<FareReviewProps> = ({ vehicleType, estimates, onConfirm, confirming = false, offer, catalogueNotice = null }) => {
  if (estimates.status === 'error') {
    return (
      <BookingStatusLine status="error" text={estimates.error ?? BOOKING_COPY.estimateFailed} onRetry={estimates.retry} />
    );
  }
  const quote = vehicleType ? estimateFor(estimates.data, vehicleType.key) : null;
  if (!vehicleType || !estimates.data || !quote) {
    return <BookingStatusLine status="loading" text={BOOKING_COPY.estimateLoading} />;
  }
  const route = estimates.data;
  const offered = offer?.band ? offer : null;
  const total = offered?.value ?? quote.fare;
  return (
    <View style={styles.review}>
      <FareNoticeBanner notice={route.fare_notice ?? catalogueNotice} />
      <View style={styles.hero}>
        <AppText variant="caption" color="textSecondary" testID="fare-estimate-title">
          {BOOKING_COPY.estimatedFareTitle}
        </AppText>
        <AppText variant="numericXL" testID="fare-estimate-amount">
          {formatFare(total, quote.currency)}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {[vehicleType.label, formatDistance(route.distance_km), formatDuration(route.duration_min)].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      {offered ? <OfferStepper offer={offered} /> : null}
      <FareBreakdown
        breakdown={quoteBreakdown(quote, offered ? offerDifference(offered.band, offered.value) : 0)}
        total={total}
        currency={quote.currency}
        distanceKm={route.distance_km}
        durationMin={route.duration_min}
        totalLabel={BOOKING_COPY.estimatedTotal}
        footnote={t('fare.lockNote')}
        testID="fare-breakdown"
      />
      <FarePolicyNote policy={quote.fare_policy} />
      <Button
        label={BOOKING_COPY.request(vehicleType.label)}
        size="lg"
        haptic="impactLight"
        onPress={onConfirm}
        loading={confirming}
        testID="fare-request"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2] },
  text: { flexShrink: 1 },
  list: { gap: space[2] },
  review: { gap: space[4] },
  hero: { alignItems: 'center', gap: space[1] },
});
