/**
 * Map taps in the booking flow (T-304, PAX-14, PAX-24). A tap changes a location only in an
 * explicit "choose on map" mode the passenger turned on, never while a ride exists, and
 * never when the tap was on a marker (Android reports `action: 'marker-press'`; the marker
 * opens its callout instead).
 */
export type MapPickTarget = 'pickup' | 'destination' | 'stop';

export interface MapTapInput {
  /** The "choose on map" mode, or null when it is off. */
  mode: MapPickTarget | null;
  /** MapPressEvent.nativeEvent.action. */
  action?: string;
  /** A ride exists (in progress or its outcome on screen). */
  rideShown: boolean;
}

/** What the tap sets, or null when it must be ignored. */
export const mapTapTarget = ({ mode, action, rideShown }: MapTapInput): MapPickTarget | null => {
  if (action === 'marker-press' || rideShown) return null;
  return mode;
};
