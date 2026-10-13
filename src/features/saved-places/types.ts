/**
 * Saved places / favourites (T-516, BE-14; docs/api/CONTRACT_NOTES.md "BE-14"). App models
 * mapped from the `SavedPlaceResource` the server returns. Plain data only, so a place can travel
 * in route params.
 */

/** At most one `home` and one `work`; up to `maxOther` `other` places. */
export type SavedPlaceLabel = 'home' | 'work' | 'other';

export interface SavedPlace {
  id: number;
  label: SavedPlaceLabel;
  /** Null for home and work (the app shows "Home"/"Work"); set for `other`. */
  name: string | null;
  address: string;
  lat: number;
  lng: number;
  /** Google place id when the place came from the search; null when unknown. */
  placeId: string | null;
  sortOrder: number;
  updatedAt: string | null;
}

export interface SavedPlacesList {
  /** Server order: home, work, then others by sort order. */
  places: SavedPlace[];
  /** How many `other` places the server allows (10 today). */
  maxOther: number;
}

/** A picked location: what the place search returns. */
export interface PickedLocation {
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
}

/** POST /saved-places body (and the full form of PUT). */
export interface SavedPlaceInput extends PickedLocation {
  label: SavedPlaceLabel;
  /** Required for `other`; ignored (sent as null) for home and work. */
  name: string | null;
}

/** POST / PUT answer. */
export interface SavedPlaceWrite {
  place: SavedPlace;
  /** POST of a home/work that already existed: the old one was replaced in place. */
  replaced: boolean;
  /** Outside the rough Pakistan box: saved anyway, the app shows a soft warning. */
  outsideServiceArea: boolean;
}
