/** T-110: loading / error / empty / count line for nearby drivers on the passenger map. */
import React from 'react';
import { render } from '@testing-library/react-native';
import { nearbyDriverDescription, NearbyDriversStatus } from '../../src/components/passenger/NearbyDrivers';
import type { NearbyDriver } from '../../src/services/rideService';

const driver: NearbyDriver = {
  id: 'abc',
  rating: 4.5,
  vehicle_type: 'car',
  distance_km: 1,
  estimated_arrival_min: 2,
  location: { latitude: 31.5, longitude: 74.3 },
};

describe('NearbyDriversStatus', () => {
  it('renders nothing while idle', () => {
    const { queryByTestId } = render(<NearbyDriversStatus state={{ drivers: [], status: 'idle', error: null }} />);
    expect(queryByTestId('nearby-drivers-status')).toBeNull();
  });

  it('loading, empty, count and error copy', () => {
    const { getByText, rerender } = render(<NearbyDriversStatus state={{ drivers: [], status: 'loading', error: null }} />);
    getByText('Finding drivers nearby…');
    rerender(<NearbyDriversStatus state={{ drivers: [], status: 'ready', error: null }} />);
    getByText('No drivers nearby right now');
    rerender(<NearbyDriversStatus state={{ drivers: [driver], status: 'ready', error: null }} />);
    getByText('1 driver nearby');
    rerender(<NearbyDriversStatus state={{ drivers: [driver, { ...driver, id: 'def' }], status: 'ready', error: null }} />);
    getByText('2 drivers nearby');
    rerender(<NearbyDriversStatus state={{ drivers: [], status: 'error', error: 'Network error. Please check your connection.' }} />);
    getByText('Network error. Please check your connection.');
  });

  it('marker text hides an unrated (0) rating', () => {
    expect(nearbyDriverDescription(driver)).toBe('car · 4.5★ · ~2 min');
    expect(nearbyDriverDescription({ ...driver, rating: 0 })).toBe('car · ~2 min');
  });
});
