/**
 * T-516: Booking accepts a pickup and/or destination (a saved place's "Set pickup" / "Set
 * destination", a Home chip). The start state follows what was given, the route is drawn once a
 * prefilled destination has a pickup (the GPS one included), new params while open are applied,
 * and a ride on screen ignores them.
 */
import { renderHook } from '@testing-library/react-native';
import { bookingPrefillState, useBookingPrefill, type BookingParams } from '../../../src/features/ride-booking/prefill';
import type { BookingPlace } from '../../../src/features/ride-booking/buildRideRequest';

const home: BookingPlace = { latitude: 31.46, longitude: 74.4, address: 'House 1, DHA Phase 5, Lahore' };
const work: BookingPlace = { latitude: 31.51, longitude: 74.35, address: 'MM Alam Road, Lahore' };
const gps: BookingPlace = { latitude: 31.5, longitude: 74.3 };

describe('bookingPrefillState', () => {
  it('no params: the normal start', () => {
    expect(bookingPrefillState(undefined)).toEqual({
      pickup: null,
      destination: null,
      pickupQuery: '',
      destQuery: '',
      stage: 'home',
      routePending: false,
      stops: [],
    });
  });

  it('destination only: keeps the GPS pickup and waits for it to draw the route', () => {
    expect(bookingPrefillState({ destination: work })).toMatchObject({
      pickup: null,
      destination: work,
      destQuery: 'MM Alam Road, Lahore',
      stage: 'home',
      routePending: true,
    });
  });

  it('pickup only: on to the destination search', () => {
    expect(bookingPrefillState({ pickup: home })).toMatchObject({
      pickup: home,
      pickupQuery: 'House 1, DHA Phase 5, Lahore',
      stage: 'destination',
      routePending: false,
    });
  });

  it('both: the vehicle step; unusable coordinates are ignored', () => {
    expect(bookingPrefillState({ pickup: home, destination: work })).toMatchObject({ stage: 'vehicle', routePending: true });
    expect(bookingPrefillState({ destination: { latitude: Number.NaN, longitude: 74 } })).toMatchObject({
      destination: null,
      stage: 'home',
    });
  });
});

type Props = { params: BookingParams | undefined; pickup: BookingPlace | null; destination: BookingPlace | null; rideShown: boolean };

const setup = (initialProps: Props) => {
  const apply = jest.fn();
  const route = jest.fn();
  const initial = bookingPrefillState(initialProps.params);
  const hook = renderHook((props: Props) => useBookingPrefill({ ...props, initial, apply, route }), { initialProps });
  return { apply, route, hook };
};

describe('useBookingPrefill', () => {
  it('both points at mount: draws the route at once and applies nothing more', () => {
    const params = { pickup: home, destination: work };
    const { apply, route } = setup({ params, pickup: home, destination: work, rideShown: false });
    expect(route).toHaveBeenCalledWith(home, work);
    expect(apply).not.toHaveBeenCalled();
  });

  it('destination at mount: routes when the GPS pickup arrives, once', () => {
    const params = { destination: work };
    const { route, hook } = setup({ params, pickup: null, destination: work, rideShown: false });
    expect(route).not.toHaveBeenCalled();
    hook.rerender({ params, pickup: gps, destination: work, rideShown: false });
    expect(route).toHaveBeenCalledWith(gps, work);
    // The pickup's address resolving later does not route again.
    hook.rerender({ params, pickup: { ...gps, address: 'Gulberg' }, destination: work, rideShown: false });
    expect(route).toHaveBeenCalledTimes(1);
  });

  it('new params while open are applied, then routed with the point already chosen', () => {
    const { apply, route, hook } = setup({ params: undefined, pickup: gps, destination: null, rideShown: false });
    expect(route).not.toHaveBeenCalled();
    const params = { destination: home };
    hook.rerender({ params, pickup: gps, destination: null, rideShown: false });
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ destination: home, pickup: null }));
    hook.rerender({ params, pickup: gps, destination: home, rideShown: false });
    expect(route).toHaveBeenCalledWith(gps, home);
  });

  it('a ride on screen ignores the prefill', () => {
    const params = { pickup: home, destination: work };
    const { apply, route, hook } = setup({ params, pickup: home, destination: work, rideShown: true });
    expect(route).not.toHaveBeenCalled();
    hook.rerender({ params: { destination: home }, pickup: home, destination: work, rideShown: true });
    expect(apply).not.toHaveBeenCalled();
  });
});
