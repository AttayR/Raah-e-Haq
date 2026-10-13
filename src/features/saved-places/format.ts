import type { IconName } from '../../components/ui/Icon';
import { firstFieldMessages, toApiError } from '../../core/api/errors';
import type { BookingPlace } from '../ride-booking/buildRideRequest';
import { t } from '../../i18n';
import type { SavedPlace, SavedPlaceLabel } from './types';

const ICONS: Record<SavedPlaceLabel, IconName> = { home: 'home', work: 'work', other: 'pin' };

/** MDI glyph per label: house, briefcase, map marker. */
export const savedPlaceIcon = (label: SavedPlaceLabel): IconName => ICONS[label];

/** "Home" / "Work" (localised), or the name the passenger gave an other place. */
export const savedPlaceTitle = (place: Pick<SavedPlace, 'label' | 'name'>): string => {
  if (place.label === 'home') return t('savedPlaces.home');
  if (place.label === 'work') return t('savedPlaces.work');
  return place.name ?? t('savedPlaces.other');
};

/** The ride point for Booking: coordinates and the saved address. */
export const toBookingPlace = (place: Pick<SavedPlace, 'lat' | 'lng' | 'address'>): BookingPlace => ({
  latitude: place.lat,
  longitude: place.lng,
  address: place.address,
});

/** How many `other` places are saved. */
export const otherCount = (places: ReadonlyArray<SavedPlace>): number => places.filter((p) => p.label === 'other').length;

/** The saved address per singleton label, for "This replaces your saved Home" in the form. */
export type TakenLabels = Partial<Record<'home' | 'work', string>>;

export const takenLabels = (places: ReadonlyArray<SavedPlace>, exceptId?: number): TakenLabels => {
  const taken: TakenLabels = {};
  places.forEach((p) => {
    if (p.id !== exceptId && (p.label === 'home' || p.label === 'work')) taken[p.label] = p.address;
  });
  return taken;
};

/**
 * The message for a failed write: a 422's field message (label cap / taken, name) first, then
 * the server's message, then `fallback`.
 */
export const savedPlaceErrorMessage = (error: unknown, fallback: string): string => {
  const apiError = toApiError(error);
  if (apiError.kind === 'validation') {
    const fields = firstFieldMessages(apiError.fieldErrors);
    return fields.label ?? fields.name ?? fields.address ?? fields.lat ?? fields.lng ?? apiError.message ?? fallback;
  }
  if (apiError.kind === 'unknown' || apiError.kind === 'cancelled') return fallback;
  return apiError.message || fallback;
};
