/**
 * Passenger Home sheet test helpers (UI-R20b): the HomeSheetBody props every test needs (the
 * service row and the peek reporting), so a test only spells out what it checks.
 */
import type React from 'react';
import type { HomeSheetBody } from '../src/features/passenger-home/components/HomeSheet';

type BodyProps = React.ComponentProps<typeof HomeSheetBody>;

export const homeBodyProps = (overrides: Partial<BodyProps> = {}): BodyProps => ({
  savedPlaces: [],
  onSavedPlace: jest.fn(),
  onAddPlace: jest.fn(),
  onSavedPlaces: jest.fn(),
  locationOff: false,
  onEnableLocation: jest.fn(),
  recentRides: [],
  onOpenRide: jest.fn(),
  onSeeAllRides: jest.fn(),
  servicesVisible: false,
  onRide: jest.fn(),
  onParcel: jest.fn(),
  onServicesShown: jest.fn(),
  onServiceRowHeight: jest.fn(),
  onPeekGroupHeight: jest.fn(),
  ...overrides,
});
