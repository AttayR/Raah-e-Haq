import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import VehicleOptions from '../../../components/passenger/VehicleOptions';
import FareDetails from '../../../components/passenger/FareDetails';
import type { FareEstimates, VehicleType } from '../api';
import type { LoadStatus } from '../hooks';
import { estimateFor } from '../hooks';
import { BOOKING_COPY } from '../copy';
import { fareBreakdownRows, formatFare, toVehicleOptions } from '../vehicleOptions';

type StatusLineProps = { status: 'loading' | 'error' | 'empty'; text: string; onRetry?: () => void };

/** One loading / error (with Retry) / empty line. */
export const BookingStatusLine: React.FC<StatusLineProps> = ({ status, text, onRetry }) => {
  const { theme } = useAppTheme();
  const color = status === 'error' ? theme.colors.danger : theme.colors.textSecondary;
  return (
    <View testID={`booking-status-${status}`} accessibilityLiveRegion="polite" style={styles.row}>
      {status === 'loading' && <ActivityIndicator size="small" color={theme.colors.accent} />}
      <Text style={[styles.text, { color }]}>{text}</Text>
      {status === 'error' && onRetry && (
        <TouchableOpacity accessibilityRole="button" onPress={onRetry} style={styles.retry}>
          <Text style={[styles.retryText, { color: theme.colors.accent }]}>{BOOKING_COPY.retry}</Text>
        </TouchableOpacity>
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
 * The vehicle list from GET /public/vehicle-types, priced by one POST /rides/estimate.
 * Loading, error (Retry) and empty states for both; a type can only be picked once priced.
 */
export const VehicleChoice: React.FC<VehicleChoiceProps> = ({ vehicleTypes, estimates, selectedId, onSelect }) => {
  if (vehicleTypes.status === 'loading' || vehicleTypes.status === 'idle') {
    return <BookingStatusLine status="loading" text={BOOKING_COPY.vehicleTypesLoading} />;
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
  const types = vehicleTypes.data ?? [];
  if (types.length === 0) {
    return <BookingStatusLine status="empty" text={BOOKING_COPY.vehicleTypesEmpty} />;
  }
  return (
    <View>
      {estimates.status === 'loading' && <BookingStatusLine status="loading" text={BOOKING_COPY.estimateLoading} />}
      {estimates.status === 'error' && (
        <BookingStatusLine
          status="error"
          text={estimates.error ?? BOOKING_COPY.estimateFailed}
          onRetry={estimates.retry}
        />
      )}
      <VehicleOptions
        options={toVehicleOptions(types, estimates.data)}
        selectedId={selectedId}
        onSelect={(key) => {
          if (estimateFor(estimates.data, key)) onSelect(key);
        }}
      />
    </View>
  );
};

type FareReviewProps = {
  vehicleType: VehicleType | null;
  estimates: Loaded<FareEstimates>;
  onConfirm: () => void;
};

/** The selected type's server quote and breakdown (BE-05), or its loading/error state. */
export const FareReview: React.FC<FareReviewProps> = ({ vehicleType, estimates, onConfirm }) => {
  if (estimates.status === 'error') {
    return (
      <BookingStatusLine status="error" text={estimates.error ?? BOOKING_COPY.estimateFailed} onRetry={estimates.retry} />
    );
  }
  const quote = vehicleType ? estimateFor(estimates.data, vehicleType.key) : null;
  if (!vehicleType || !estimates.data || !quote) {
    return <BookingStatusLine status="loading" text={BOOKING_COPY.estimateLoading} />;
  }
  return (
    <FareDetails
      vehicleName={vehicleType.label}
      distanceKm={`${estimates.data.distance_km} km`}
      estimate={formatFare(quote.fare, quote.currency)}
      breakdown={fareBreakdownRows(quote, estimates.data)}
      onConfirm={onConfirm}
    />
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  text: { fontSize: 13, flexShrink: 1 },
  retry: { paddingHorizontal: 8, paddingVertical: 4 },
  retryText: { fontSize: 13, fontWeight: '700' },
});
