/**
 * passenger-trip-complete §7 / shared-support-invite routes: the passenger receipt (completed and
 * cancelled) has a ghost "Get help with this ride" that opens SupportNewRequest with this ride as
 * the trip; outside a navigator (the gallery) it is not drawn.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { NavigationContext } from '@react-navigation/native';
import { apiClient } from '../../../src/services/api';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import { PassengerTripSheet } from '../../../src/features/active-ride/trip/PassengerTripSheet';
import { advanceRideStage, type PassengerRideStageState } from '../../../src/features/active-ride/stage';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const stateOf = (ride: RideResource): PassengerRideStageState => {
  const state = advanceRideStage(null, ride);
  if (!state) throw new Error('no stage');
  return state;
};

const ended = (overrides: Partial<RideResource>): RideResource =>
  makeRide({
    id: 31,
    driver_id: 5,
    driver: { id: 5, name: 'Ali Raza', rating: 4.9 },
    pickup_address: 'Liberty Market, Gulberg III, Lahore',
    dropoff_address: 'Emporium Mall, Johar Town, Lahore',
    ...overrides,
  });

const makeNavigation = () => {
  const navigate = jest.fn();
  const navigation = {
    navigate,
    isFocused: () => true,
    addListener: () => () => undefined,
  } as unknown as React.ContextType<typeof NavigationContext>;
  return { navigate, navigation };
};

const renderReceipt = (ride: RideResource, navigation?: React.ContextType<typeof NavigationContext>) => {
  const store = configureStore({ reducer: { activeRide: activeRideReducer }, preloadedState: { activeRide: { ...initialActiveRideState, ride } } });
  const sheet = <PassengerTripSheet stageState={stateOf(ride)} ride={ride} driverLocation={null} onCancel={jest.fn()} onFinish={jest.fn()} />;
  render(
    <Provider store={store}>
      {navigation ? <NavigationContext.Provider value={navigation}>{sheet}</NavigationContext.Provider> : sheet}
    </Provider>,
  );
};

describe('receipt: Get help with this ride', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet('/rating-tags').reply(200, {
      success: true,
      data: { window_days: 7, max_tags: 2, max_comment_length: 500, positive_min_stars: 4, negative_max_stars: 4, tags: { passenger: { positive: [], negative: [] }, driver: { positive: [], negative: [] } } },
    });
    resetRatingSessionState();
  });
  afterEach(() => mock.restore());

  const flush = async () => {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
    });
  };

  it('a completed ride opens a new request prefilled with this trip', async () => {
    const { navigate, navigation } = makeNavigation();
    renderReceipt(ended({ status: 'completed', total_fare: 310, completed_at: '2026-10-20T11:40:00Z', can_rate: false } as Partial<RideResource>), navigation);
    await flush();
    const help = screen.getByTestId('receipt-help');
    expect(help).toHaveTextContent(/Get help with this ride$/);
    fireEvent.press(help);
    expect(navigate).toHaveBeenCalledWith('SupportNewRequest', {
      trip: {
        id: 31,
        pickupAddress: 'Liberty Market, Gulberg III, Lahore',
        dropoffAddress: 'Emporium Mall, Johar Town, Lahore',
        at: '2026-10-20T11:40:00Z',
      },
    });
  });

  it('a cancelled ride has it too', async () => {
    const { navigate, navigation } = makeNavigation();
    renderReceipt(ended({ status: 'cancelled', cancellation_reason: 'passenger', cancelled_at: '2026-10-20T11:05:00Z' } as Partial<RideResource>), navigation);
    await flush();
    fireEvent.press(screen.getByTestId('receipt-help'));
    expect(navigate).toHaveBeenCalledWith('SupportNewRequest', { trip: expect.objectContaining({ id: 31, at: '2026-10-20T11:05:00Z' }) });
  });

  it('is not drawn outside a navigator', async () => {
    renderReceipt(ended({ status: 'completed', total_fare: 310, can_rate: false } as Partial<RideResource>));
    await flush();
    expect(screen.getByText("You've arrived")).toBeTruthy();
    expect(screen.queryByTestId('receipt-help')).toBeNull();
  });
});
