/** T-304 (PAX-14, PAX-24): map taps set a location only in the explicit choose-on-map mode. */
import { mapTapTarget } from '../../../src/features/ride-booking/mapTap';

describe('mapTapTarget', () => {
  it('ignores taps when choose-on-map is off (a tap no longer resets the trip)', () => {
    expect(mapTapTarget({ mode: null, rideShown: false })).toBeNull();
    expect(mapTapTarget({ mode: null, action: 'press', rideShown: false })).toBeNull();
  });

  it('PAX-24: a marker press never sets a location, even in choose-on-map mode', () => {
    expect(mapTapTarget({ mode: 'destination', action: 'marker-press', rideShown: false })).toBeNull();
  });

  it('never changes locations while a ride exists', () => {
    expect(mapTapTarget({ mode: 'pickup', action: 'press', rideShown: true })).toBeNull();
  });

  it('returns the mode the passenger chose', () => {
    expect(mapTapTarget({ mode: 'pickup', rideShown: false })).toBe('pickup');
    expect(mapTapTarget({ mode: 'destination', action: 'press', rideShown: false })).toBe('destination');
    expect(mapTapTarget({ mode: 'stop', rideShown: false })).toBe('stop');
  });
});
