import type { BookingParams } from '../ride-booking/prefill';
import type { TakenLabels } from './format';
import { toBookingPlace } from './format';
import type { PickedLocation, SavedPlace, SavedPlaceLabel } from './types';

/** `SavedPlaceEditor` params: an existing place to edit, or a new one (optionally a label). */
export type SavedPlaceEditorParams = {
  /** Editing this place; absent for a new one. */
  place?: SavedPlace;
  /** Start a new place with this label ("Add home" / "Add work"). */
  label?: SavedPlaceLabel;
  /** Home/Work already saved (their addresses), so the form can say it replaces them. */
  taken?: TakenLabels;
  /** Other places are at the server's cap: the form does not offer "Other". */
  otherFull?: boolean;
  /**
   * UI-R9b: start with this location (a recent destination's "Save as Home / Work / place");
   * with `place` it replaces that place's location when saved. Nothing is written before Save.
   */
  location?: PickedLocation;
};

/** What the saved-places screens and the Home chips navigate with. */
export type SavedPlacesNavigator = {
  navigate(name: 'Booking', params: BookingParams): void;
  navigate(name: 'SavedPlaceEditor', params: SavedPlaceEditorParams): void;
  navigate(name: 'FavoriteLocations'): void;
  goBack(): void;
};

export type BookingRole = 'pickup' | 'destination';

/** `Booking` params that start the booking flow with this place as pickup or destination. */
export const bookingParamsFor = (place: SavedPlace, role: BookingRole): BookingParams =>
  role === 'pickup' ? { pickup: toBookingPlace(place) } : { destination: toBookingPlace(place) };
