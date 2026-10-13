import { apiService, unwrap } from '../../services/api';
import { isRecord, readId, readNumber, readNumberOrNull, readOneOf, readText } from '../../core/api/read';
import type { PickedLocation, SavedPlace, SavedPlaceInput, SavedPlaceLabel, SavedPlacesList, SavedPlaceWrite } from './types';

/**
 * Saved places (T-516, BE-14; docs/api/CONTRACT_NOTES.md), all through the shared axios client:
 * - GET    /saved-places      -> data: { places: SP[], max_other }
 * - POST   /saved-places      -> data: { place, replaced, outside_service_area } (home/work replace)
 * - PUT    /saved-places/{id} -> data: { place, replaced: false, outside_service_area }
 * - DELETE /saved-places/{id} -> data: null
 * 422 (label cap / taken, name missing) and 404 (not the caller's place) arrive as ApiErrors.
 */

const LABELS: ReadonlyArray<SavedPlaceLabel> = ['home', 'work', 'other'];
/** The contract's cap, used when the server leaves `max_other` out. */
export const DEFAULT_MAX_OTHER = 10;

/** One `SavedPlaceResource`; null without an id, an address or usable coordinates. */
export const toSavedPlace = (raw: unknown): SavedPlace | null => {
  if (!isRecord(raw)) return null;
  const id = readId(raw.id);
  const address = readText(raw.address);
  const lat = readNumberOrNull(raw.lat);
  const lng = readNumberOrNull(raw.lng);
  if (id === null || address === null || lat === null || lng === null) return null;
  const label = readOneOf(raw.label, LABELS, 'other');
  return {
    id,
    label,
    name: label === 'other' ? readText(raw.name) : null,
    address,
    lat,
    lng,
    placeId: readText(raw.place_id),
    sortOrder: readNumber(raw.sort_order),
    updatedAt: readText(raw.updated_at),
  };
};

export const toSavedPlacesList = (raw: unknown): SavedPlacesList => {
  const data = isRecord(raw) ? raw : {};
  const places = (Array.isArray(data.places) ? data.places : [])
    .map(toSavedPlace)
    .filter((place): place is SavedPlace => place !== null);
  const maxOther = readId(data.max_other) ?? DEFAULT_MAX_OTHER;
  return { places, maxOther };
};

export const toSavedPlaceWrite = (raw: unknown): SavedPlaceWrite => {
  const data = isRecord(raw) ? raw : {};
  const place = toSavedPlace(data.place);
  if (!place) throw new Error('Invalid saved place response');
  return { place, replaced: data.replaced === true, outsideServiceArea: data.outside_service_area === true };
};

/** What the server accepts as `place_id` (BE-14); anything else is left out rather than refused. */
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/;

/** The location part of a request body; `place_id` only when there is a valid one. */
const locationBody = (location: PickedLocation): Record<string, unknown> => ({
  address: location.address,
  lat: location.lat,
  lng: location.lng,
  ...(location.placeId && PLACE_ID.test(location.placeId) ? { place_id: location.placeId } : {}),
});

/** POST body: `name` only for `other`. */
export const toCreateBody = (input: SavedPlaceInput): Record<string, unknown> => ({
  label: input.label,
  ...(input.label === 'other' ? { name: input.name } : {}),
  ...locationBody(input),
});

/**
 * PUT body from the place as it was and the edited form: label and name always, the location
 * only when it moved (so an untouched place keeps its stored place_id).
 */
export const toUpdateBody = (before: SavedPlace, input: SavedPlaceInput): Record<string, unknown> => {
  const moved = before.address !== input.address || before.lat !== input.lat || before.lng !== input.lng;
  return {
    label: input.label,
    name: input.label === 'other' ? input.name : null,
    ...(moved ? locationBody(input) : {}),
  };
};

export const savedPlacesApi = {
  async list(): Promise<SavedPlacesList> {
    return toSavedPlacesList(unwrap(await apiService.get<unknown>('/saved-places')));
  },

  async create(input: SavedPlaceInput): Promise<SavedPlaceWrite> {
    return toSavedPlaceWrite(unwrap(await apiService.post<unknown>('/saved-places', toCreateBody(input))));
  },

  async update(before: SavedPlace, input: SavedPlaceInput): Promise<SavedPlaceWrite> {
    return toSavedPlaceWrite(unwrap(await apiService.put<unknown>(`/saved-places/${before.id}`, toUpdateBody(before, input))));
  },

  async remove(id: number): Promise<void> {
    await apiService.delete<unknown>(`/saved-places/${id}`);
  },
};
