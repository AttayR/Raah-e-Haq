/**
 * T-524 (QA t-517: typing "Lib" suggested Liberia and Libya): place search is limited to
 * Pakistan and, with a known position, biased around it; geocoding and details carry region=pk.
 */
import {
  PLACES_BIAS_RADIUS_M,
  autocompleteUrl,
  fetchAutocomplete,
  fetchPlaceDetails,
  reverseGeocode,
} from '../../src/services/placesService';

const params = (url: string) => new URL(url).searchParams;

describe('autocompleteUrl', () => {
  it('restricts to Pakistan and ranks for the pk region', () => {
    const p = params(autocompleteUrl('Lib'));
    expect(p.get('input')).toBe('Lib');
    expect(p.get('components')).toBe('country:pk');
    expect(p.get('region')).toBe('pk');
    expect(p.get('location')).toBeNull();
  });

  it('biases around a known position (the rider or the pickup)', () => {
    const p = params(autocompleteUrl('Lib', { latitude: 31.5204, longitude: 74.3587 }));
    expect(p.get('location')).toBe('31.5204,74.3587');
    expect(p.get('radius')).toBe(String(PLACES_BIAS_RADIUS_M));
    expect(p.get('components')).toBe('country:pk');
  });

  it('ignores a missing or placeholder (0,0) position', () => {
    expect(params(autocompleteUrl('Lib', null)).get('location')).toBeNull();
    expect(params(autocompleteUrl('Lib', { latitude: 0, longitude: 0 })).get('location')).toBeNull();
    expect(params(autocompleteUrl('Lib', { latitude: Number.NaN, longitude: 74 })).get('location')).toBeNull();
  });

  it('encodes the query', () => {
    expect(params(autocompleteUrl('Gulberg & Co')).get('input')).toBe('Gulberg & Co');
  });
});

describe('every lookup carries the Pakistan bias', () => {
  const fetchMock = jest.fn();
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const respond = (json: unknown) => fetchMock.mockResolvedValueOnce({ ok: true, json: async () => json });

  it('fetchAutocomplete sends the restricted, biased request', async () => {
    respond({ status: 'OK', predictions: [{ place_id: 'p1', description: 'Liberty Market, Lahore, Pakistan' }] });
    const items = await fetchAutocomplete('Lib', { latitude: 31.52, longitude: 74.35 });
    expect(items).toHaveLength(1);
    const p = params(fetchMock.mock.calls[0][0]);
    expect(p.get('components')).toBe('country:pk');
    expect(p.get('location')).toBe('31.52,74.35');
  });

  it('place details and reverse geocoding ask for the pk region', async () => {
    respond({ status: 'OK', result: { geometry: { location: { lat: 31.5, lng: 74.3 } }, formatted_address: 'Lahore' } });
    await fetchPlaceDetails('p1');
    expect(params(fetchMock.mock.calls[0][0]).get('region')).toBe('pk');

    respond({ status: 'OK', results: [{ formatted_address: 'Gulberg III, Lahore, Pakistan' }] });
    await reverseGeocode(31.5, 74.3);
    expect(params(fetchMock.mock.calls[1][0]).get('region')).toBe('pk');
  });
});
