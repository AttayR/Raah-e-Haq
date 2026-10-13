/**
 * T-517 polish: the passenger's driver marker snaps to the booking route only on the trip;
 * heading to the pickup it interpolates without the route.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import {
  AssignedDriverMarker,
  trackingRouteFor,
} from '../../../src/features/active-ride/components/ActiveRidePanel';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';
import type { DriverLocation } from '../../../src/services/rideService';

const M_PER_DEG_LAT = 111_195;
const at = (north: number, east = 0) => ({
  latitude: 31.5 + north / M_PER_DEG_LAT,
  longitude: 74.3 + east / (M_PER_DEG_LAT * Math.cos((31.5 * Math.PI) / 180)),
});
const ROUTE = [at(0), at(500)];
const location = (p: { latitude: number; longitude: number }): DriverLocation => ({
  driver_id: 5,
  ...p,
  heading: null,
  status: 'busy',
  last_seen_at: 't',
});

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

const coordinate = () => screen.getByTestId('assigned-driver-marker').props.coordinate as { latitude: number; longitude: number };

describe('trackingRouteFor', () => {
  it('is the route only while the trip is under way', () => {
    expect(trackingRouteFor('in_trip', ROUTE)).toBe(ROUTE);
    expect(trackingRouteFor('driver_en_route', ROUTE)).toBeNull();
    expect(trackingRouteFor('driver_arrived', ROUTE)).toBeNull();
    expect(trackingRouteFor(null, ROUTE)).toBeNull();
    expect(trackingRouteFor('in_trip', [at(0)])).toBeNull();
    expect(trackingRouteFor('in_trip', null)).toBeNull();
  });
});

describe('AssignedDriverMarker', () => {
  it('on the trip: a position 10 m off the route is drawn on the road', async () => {
    render(<AssignedDriverMarker location={location(at(200, 10))} stage="in_trip" route={ROUTE} vehicleType="bike" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(distanceMeters(coordinate(), at(200))).toBeLessThan(0.5);
  });

  it('heading to the pickup: the same position is not pulled onto the trip route', async () => {
    render(<AssignedDriverMarker location={location(at(200, 10))} stage="driver_en_route" route={ROUTE} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(distanceMeters(coordinate(), at(200, 10))).toBeLessThan(0.01);
  });
});
