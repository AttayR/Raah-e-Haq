import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  FareBreakdown,
  FareTag,
  VehicleOptionCard,
  VehicleOptionSkeleton,
} from '../../../components/ui';
import type { FareEstimates } from '../api';
import type { LoadStatus } from '../hooks';
import { BOOKING_COPY } from '../copy';
import { componentTokens, space } from '../../../theme';
import { t } from '../../../i18n';
import { formatFare, quoteBreakdown, type VehicleOption } from '../vehicleOptions';
import { FarePolicyNote } from '../../fare/components/FareBits';
import { OfferStepper } from '../../fare/components/OfferStepper';
import type { FareOffer } from '../../fare/hooks';
import { offerDifference } from '../../fare/offer';
import type { FareEstimate } from '../api';

type Loaded<T> = { status: LoadStatus; data: T | null; error: string | null; retry: () => void };

type RowProps = { option: VehicleOption; selected: boolean; onSelect: (key: string) => void };

/** One tier (VehicleOptionCard, §5.25); memoised, so a new selection re-renders two rows only. */
const VehicleRow = React.memo(function VehicleRow({ option, selected, onSelect }: RowProps) {
  const { id } = option;
  const onPress = useCallback(() => onSelect(id), [onSelect, id]);
  return (
    <VehicleOptionCard
      vehicleKey={option.id}
      name={option.name}
      meta={option.meta}
      fare={option.fare}
      unavailable={option.unavailable}
      ac={option.ac}
      selected={selected}
      onPress={onPress}
      testID={`vehicle-option-${option.id}`}
    />
  );
});

type VehicleChoiceProps = {
  /** The catalogue read (GET /public/vehicle-types): its retry, and whether it is still loading. */
  vehicleTypes: Pick<Loaded<unknown>, 'status' | 'error' | 'retry'>;
  estimates: Loaded<FareEstimates>;
  /** The ride tiers priced by the estimate (`toVehicleOptions`), in the server's order. */
  options: ReadonlyArray<VehicleOption>;
  selectedId?: string;
  onSelect: (key: string) => void;
};

/**
 * The tier list of the choose-ride sheet (passenger-vehicle-fare.md block 4, UI-R10): three
 * skeleton cards while the catalogue or the prices load, a compact ErrorState ("Couldn't get
 * prices", Try again) when either read fails, a compact EmptyState when no tier is offered here,
 * else one VehicleOptionCard per tier with the server's name, the AC badge and the quoted fare. A
 * tier without a quote is shown unavailable and cannot be chosen.
 */
export const VehicleChoice: React.FC<VehicleChoiceProps> = ({ vehicleTypes, estimates, options, selectedId, onSelect }) => {
  if (vehicleTypes.status === 'error' || estimates.status === 'error') {
    const failed = vehicleTypes.status === 'error' ? vehicleTypes : estimates;
    return (
      <ErrorState
        size="compact"
        kind="network"
        title={BOOKING_COPY.pricesFailedTitle}
        onRetry={failed.retry}
        testID="booking-status-error"
      />
    );
  }
  const typesLoading = vehicleTypes.status === 'loading' || vehicleTypes.status === 'idle';
  if (typesLoading || (options.length > 0 && estimates.status !== 'ready')) {
    return (
      <View accessible accessibilityLabel={BOOKING_COPY.estimateLoading} accessibilityLiveRegion="polite">
        <VehicleOptionSkeleton testID="vehicle-options-loading" />
      </View>
    );
  }
  const bookable = options.some((o) => o.fare !== null && !o.unavailable);
  if (options.length === 0 || !bookable) {
    return (
      <EmptyState
        size="compact"
        icon="carOff"
        title={BOOKING_COPY.noRidesTitle}
        body={BOOKING_COPY.noRidesBody}
        testID="booking-status-empty"
      />
    );
  }
  return (
    <View style={styles.list} accessibilityRole="radiogroup" testID="vehicle-options">
      {options.map((option) => (
        <VehicleRow key={option.id} option={option} selected={selectedId === option.id} onSelect={onSelect} />
      ))}
    </View>
  );
};

type SelectedFareProps = {
  quote: FareEstimate;
  distanceKm: number;
  durationMin: number;
  /** BE-83: the passenger's offer for this quote (the stepper renders only with a band). */
  offer?: FareOffer;
  /** Start with Fare details expanded (Debug gallery evidence). */
  defaultOpen?: boolean;
};

/**
 * The selected tier's fare, inline under the list (UI-R10, §12.5): "Offer your fare" inside the
 * server's band (T-521, ±20%, the passenger may offer within it, no haggling), the FareTag (UI-R21),
 * and a "Fare details" toggle that expands the server breakdown (§5.26) and the waiting / cancel
 * terms in place. No separate fare step. UI-R10 polish: one fare-lock note (the FareTag); the open
 * breakdown's footnote only adds when it locks and the cash and extras terms.
 */
export const SelectedFare: React.FC<SelectedFareProps> = ({ quote, distanceKm, durationMin, offer, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const offered = offer?.band ? offer : null;
  const total = offered?.value ?? quote.fare;
  return (
    <View style={styles.fare} testID="selected-fare">
      {offered ? <OfferStepper offer={offered} /> : null}
      {/* UI-R21 §1.7 M4: replaces the lock caption; "Your offer" once the offer is off the quote. */}
      <FareTag kind={offered && offerDifference(offered.band, offered.value) !== 0 ? 'offer' : 'fixed'} testID="fare-lock-note" />
      {/* UI-R10 polish (UI-R9b): the ghost's glyph sits on the 16 gutter, not 16 inside it. */}
      <View style={styles.ghostAlign} testID="fare-details-toggle-wrap">
        <Button
          label={open ? BOOKING_COPY.hideFareDetails : BOOKING_COPY.fareDetails}
          variant="ghost"
          size="sm"
          leadingIcon="info"
          trailingIcon={open ? 'chevronUp' : 'chevronDown'}
          fullWidth={false}
          onPress={() => setOpen((v) => !v)}
          testID="fare-details-toggle"
        />
      </View>
      {open ? (
        <View style={styles.details}>
          <FareBreakdown
            breakdown={quoteBreakdown(quote, offered ? offerDifference(offered.band, offered.value) : 0)}
            total={total}
            currency={quote.currency}
            distanceKm={distanceKm}
            durationMin={durationMin}
            totalLabel={BOOKING_COPY.estimatedTotal}
            footnote={t('fare.lockTerms')}
            testID="fare-breakdown"
          />
          <FarePolicyNote policy={quote.fare_policy} />
        </View>
      ) : null}
    </View>
  );
};

/** The fare the footer button names: the passenger's offer inside the band, else the quote. */
export const requestFareText = (quote: FareEstimate | null, offer?: FareOffer): string | null => {
  if (!quote) return null;
  const value = offer?.band && offer.value !== null ? offer.value : quote.fare;
  return formatFare(value, quote.currency);
};

const styles = StyleSheet.create({
  list: { gap: space[2] },
  fare: { gap: space[2] },
  details: { gap: space[2] },
  ghostAlign: { alignSelf: 'flex-start', marginStart: -componentTokens.button.paddingHorizontal.sm },
});
