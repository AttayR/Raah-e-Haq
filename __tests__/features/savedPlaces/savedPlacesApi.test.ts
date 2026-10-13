/**
 * T-516 (BE-14): saved places are mapped from the contract in one place, and the API calls use
 * its paths and bodies: name only for "other", place_id only when valid, an edit sends the
 * location only when it moved (so the stored place_id survives an untouched place).
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  DEFAULT_MAX_OTHER,
  savedPlacesApi,
  toCreateBody,
  toSavedPlace,
  toSavedPlacesList,
  toUpdateBody,
} from '../../../src/features/saved-places/api';
import { savedPlaceErrorMessage, savedPlaceTitle, takenLabels, toBookingPlace } from '../../../src/features/saved-places/format';
import { bookingParamsFor } from '../../../src/features/saved-places/navigation';
import type { SavedPlace } from '../../../src/features/saved-places/types';

/** BE-14 `SP` objects (fake local data only). */
const rawPlace = (overrides: Record<string, unknown> = {}) => ({
  id: 3,
  label: 'home',
  name: null,
  address: 'House 1, DHA Phase 5, Lahore',
  lat: 31.4627,
  lng: 74.4085,
  place_id: 'ChIJabc_123-x',
  sort_order: 0,
  updated_at: '2026-10-13T12:00:00+00:00',
  ...overrides,
});

const place = (overrides: Partial<SavedPlace> = {}): SavedPlace => ({
  id: 3,
  label: 'other',
  name: 'Gym',
  address: 'Gym, Gulberg, Lahore',
  lat: 31.5,
  lng: 74.3,
  placeId: 'ChIJgym',
  sortOrder: 1,
  updatedAt: null,
  ...overrides,
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
});

describe('mapping', () => {
  it('maps every BE-14 field; home/work have no name', () => {
    expect(toSavedPlace(rawPlace({ name: 'ignored' }))).toEqual({
      id: 3,
      label: 'home',
      name: null,
      address: 'House 1, DHA Phase 5, Lahore',
      lat: 31.4627,
      lng: 74.4085,
      placeId: 'ChIJabc_123-x',
      sortOrder: 0,
      updatedAt: '2026-10-13T12:00:00+00:00',
    });
    expect(toSavedPlace(rawPlace({ label: 'other', name: 'Gym', place_id: null }))).toMatchObject({
      label: 'other',
      name: 'Gym',
      placeId: null,
    });
  });

  it('drops rows without an id, address or coordinates and reads numeric strings', () => {
    expect(toSavedPlace(rawPlace({ id: null }))).toBeNull();
    expect(toSavedPlace(rawPlace({ address: ' ' }))).toBeNull();
    expect(toSavedPlace(rawPlace({ lat: 'x' }))).toBeNull();
    expect(toSavedPlace(rawPlace({ lat: '31.5', lng: '74.3' }))).toMatchObject({ lat: 31.5, lng: 74.3 });
    const list = toSavedPlacesList({ places: [rawPlace(), { id: 9 }, 'junk'], max_other: 10 });
    expect(list.places.map((p) => p.id)).toEqual([3]);
    expect(list.maxOther).toBe(10);
    expect(toSavedPlacesList({}).maxOther).toBe(DEFAULT_MAX_OTHER);
  });

  it('titles, booking points, taken labels and route params', () => {
    expect(savedPlaceTitle(place({ label: 'home', name: null }))).toBe('Home');
    expect(savedPlaceTitle(place({ label: 'work', name: null }))).toBe('Work');
    expect(savedPlaceTitle(place())).toBe('Gym');
    expect(toBookingPlace(place())).toEqual({ latitude: 31.5, longitude: 74.3, address: 'Gym, Gulberg, Lahore' });
    expect(bookingParamsFor(place(), 'pickup')).toEqual({ pickup: toBookingPlace(place()) });
    expect(bookingParamsFor(place(), 'destination')).toEqual({ destination: toBookingPlace(place()) });
    const home = place({ id: 1, label: 'home', address: 'H' });
    const work = place({ id: 2, label: 'work', address: 'W' });
    expect(takenLabels([home, work, place()])).toEqual({ home: 'H', work: 'W' });
    expect(takenLabels([home, work], 1)).toEqual({ work: 'W' });
  });
});

describe('request bodies', () => {
  it('POST sends name only for other, and place_id only when it is valid', () => {
    const location = { address: 'A', lat: 31, lng: 74, placeId: 'ChIJ_ok-1' };
    expect(toCreateBody({ ...location, label: 'home', name: 'x' })).toEqual({
      label: 'home',
      address: 'A',
      lat: 31,
      lng: 74,
      place_id: 'ChIJ_ok-1',
    });
    expect(toCreateBody({ ...location, placeId: 'bad id!', label: 'other', name: 'Gym' })).toEqual({
      label: 'other',
      name: 'Gym',
      address: 'A',
      lat: 31,
      lng: 74,
    });
  });

  it('PUT keeps the location out unless it moved; home/work send name null', () => {
    const before = place();
    expect(toUpdateBody(before, { ...before, label: 'other', name: 'Gym 2' })).toEqual({ label: 'other', name: 'Gym 2' });
    expect(toUpdateBody(before, { ...before, label: 'work', name: 'Gym' })).toEqual({ label: 'work', name: null });
    expect(toUpdateBody(before, { address: 'New', lat: 31.6, lng: 74.4, placeId: 'ChIJnew', label: 'other', name: 'Gym' })).toEqual({
      label: 'other',
      name: 'Gym',
      address: 'New',
      lat: 31.6,
      lng: 74.4,
      place_id: 'ChIJnew',
    });
  });
});

describe('savedPlacesApi', () => {
  it('GET /saved-places', async () => {
    mock.onGet('/saved-places').reply(200, { success: true, data: { places: [rawPlace()], max_other: 10 } });
    const list = await savedPlacesApi.list();
    expect(list.places).toHaveLength(1);
    expect(list.maxOther).toBe(10);
  });

  it('POST /saved-places returns the place, replaced and the service-area flag', async () => {
    mock.onPost('/saved-places').reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ label: 'home', address: 'A', lat: 31, lng: 74 });
      return [200, { success: true, data: { place: rawPlace(), replaced: true, outside_service_area: false } }];
    });
    const result = await savedPlacesApi.create({ label: 'home', name: null, address: 'A', lat: 31, lng: 74, placeId: null });
    expect(result).toMatchObject({ replaced: true, outsideServiceArea: false, place: { id: 3 } });
  });

  it('PUT /saved-places/{id} and DELETE /saved-places/{id}', async () => {
    mock.onPut('/saved-places/3').reply(200, {
      success: true,
      data: { place: rawPlace({ label: 'other', name: 'Gym 2' }), replaced: false, outside_service_area: true },
    });
    mock.onDelete('/saved-places/3').reply(200, { success: true, data: null });
    const result = await savedPlacesApi.update(place(), { ...place(), name: 'Gym 2' });
    expect(result.outsideServiceArea).toBe(true);
    await expect(savedPlacesApi.remove(3)).resolves.toBeUndefined();
  });

  it('a 422 shows the field message (label cap) instead of a generic one', async () => {
    mock.onPost('/saved-places').reply(422, {
      success: false,
      message: 'The given data was invalid.',
      errors: { label: ['You can save up to 10 other places. Delete one first.'] },
    });
    const error = await savedPlacesApi
      .create({ label: 'other', name: 'X', address: 'A', lat: 31, lng: 74, placeId: null })
      .catch((e: unknown) => e);
    expect(savedPlaceErrorMessage(error, 'fallback')).toBe('You can save up to 10 other places. Delete one first.');
    expect(savedPlaceErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});
