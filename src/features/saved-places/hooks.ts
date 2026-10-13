import { useCallback, useRef } from 'react';
import { isApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { t } from '../../i18n';
import { savedPlacesApi } from './api';
import type { SavedPlace, SavedPlaceInput, SavedPlacesList, SavedPlaceWrite } from './types';

export interface SavedPlacesState extends RemoteData<SavedPlacesList> {
  /** The places (empty while loading or after a failed first load). */
  places: SavedPlace[];
  maxOther: number | null;
  /**
   * Optimistic delete: the row leaves at once and comes back where it was if DELETE fails (the
   * promise then rejects with the ApiError, for the caller's toast). A 404 (already gone) counts
   * as deleted.
   */
  remove: (place: SavedPlace) => Promise<void>;
}

/**
 * GET /saved-places for a screen (T-516, BE-14): loading / refreshing / failed with the last good
 * list kept, refetched quietly each time `enabled` turns true again (screen focus), so a place
 * added or edited on the form shows when the list comes back on screen.
 */
export function useSavedPlaces(enabled: boolean): SavedPlacesState {
  const fetch = useCallback(() => savedPlacesApi.list(), []);
  const remote = useRemoteData<SavedPlacesList>({ fetch, fallbackError: t('savedPlaces.loadFailed'), enabled });
  const { data, setData } = remote;
  const dataRef = useRef(data);
  dataRef.current = data;

  const remove = useCallback(
    async (place: SavedPlace) => {
      const before = dataRef.current;
      if (!before) return;
      const index = before.places.findIndex((p) => p.id === place.id);
      if (index < 0) return;
      setData({ ...before, places: before.places.filter((p) => p.id !== place.id) });
      try {
        await savedPlacesApi.remove(place.id);
      } catch (cause: unknown) {
        if (isNotFound(cause)) return;
        // Put it back in its old position in whatever list is current now.
        const now = dataRef.current ?? before;
        if (!now.places.some((p) => p.id === place.id)) {
          const places = [...now.places];
          places.splice(Math.min(index, places.length), 0, place);
          setData({ ...now, places });
        }
        throw cause;
      }
    },
    [setData],
  );

  return { ...remote, places: data?.places ?? [], maxOther: data?.maxOther ?? null, remove };
}

const isNotFound = (cause: unknown): boolean => isApiError(cause) && cause.kind === 'not_found';

/** POST for a new place, PUT for an edit; resolves with the server's answer. */
export const saveSavedPlace = (input: SavedPlaceInput, editing: SavedPlace | null): Promise<SavedPlaceWrite> =>
  editing ? savedPlacesApi.update(editing, input) : savedPlacesApi.create(input);
