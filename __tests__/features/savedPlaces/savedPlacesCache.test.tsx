/**
 * T-536 (PERF-19): Home and the Saved places screen share one GET /saved-places for a minute;
 * a save drops the cached list, so the place just added shows on the next focus.
 */
import MockAdapter from 'axios-mock-adapter';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { saveSavedPlace, useSavedPlaces } from '../../../src/features/saved-places/hooks';

const home = { id: 1, label: 'home', name: null, address: 'House 1, DHA Phase 5, Lahore', lat: 31.46, lng: 74.4, place_id: null, sort_order: 0, updated_at: null };
const work = { id: 2, label: 'work', name: null, address: 'MM Alam Road, Lahore', lat: 31.51, lng: 74.35, place_id: null, sort_order: 0, updated_at: null };
const listBody = (places: unknown[]) => ({ success: true, data: { places, max_other: 10 } });

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
});

const listGets = () => mock.history.get.filter((r) => r.url === '/saved-places');

it('a second screen within a minute reuses the list; a save makes the next focus read again', async () => {
  mock.onGet('/saved-places').replyOnce(200, listBody([home])).onGet('/saved-places').reply(200, listBody([home, work]));
  mock.onPost('/saved-places').reply(201, { success: true, data: { place: work, replaced: false } });

  const homeScreen = renderHook(({ on }: { on: boolean }) => useSavedPlaces(on), { initialProps: { on: true } });
  await waitFor(() => expect(homeScreen.result.current.places).toHaveLength(1));

  const listScreen = renderHook(() => useSavedPlaces(true));
  expect(listScreen.result.current.places).toHaveLength(1);
  expect(listGets()).toHaveLength(1);

  await saveSavedPlace({ label: 'work', name: null, address: work.address, lat: work.lat, lng: work.lng, placeId: null }, null);

  // Home comes back into focus after the form: the new place is read from the server.
  homeScreen.rerender({ on: false });
  homeScreen.rerender({ on: true });
  await waitFor(() => expect(homeScreen.result.current.places).toHaveLength(2));
  expect(listGets()).toHaveLength(2);
});

/** A GET /saved-places answer the test releases by hand (the server read it before the write). */
const heldList = (places: unknown[]) => {
  let release: () => void = () => {};
  const reply = () =>
    new Promise<[number, unknown]>((resolve) => {
      release = () => resolve([200, listBody(places)]);
    });
  return { reply, release: () => release() };
};

it('a delete during an in-flight refresh is not undone by the old list landing late', async () => {
  const stale = heldList([home, work]);
  mock.onGet('/saved-places').replyOnce(200, listBody([home, work])).onGet('/saved-places').replyOnce(stale.reply);
  mock.onDelete('/saved-places/2').reply(200, { success: true, data: null });

  const screen = renderHook(() => useSavedPlaces(true));
  await waitFor(() => expect(screen.result.current.places).toHaveLength(2));

  let refreshing: Promise<void> = Promise.resolve();
  act(() => {
    refreshing = screen.result.current.refresh();
  });
  await waitFor(() => expect(listGets()).toHaveLength(2));
  const workPlace = screen.result.current.places.find((p) => p.id === 2);
  expect(workPlace).toBeDefined();
  await act(async () => {
    if (workPlace) await screen.result.current.remove(workPlace);
  });
  await act(async () => {
    stale.release();
    await refreshing;
  });

  // Another screen within the TTL sees the list without the deleted place, from the cache.
  const other = renderHook(() => useSavedPlaces(true));
  expect(other.result.current.places.map((p) => p.id)).toEqual([1]);
  expect(listGets()).toHaveLength(2);
});

it('a save during an in-flight GET: the old answer is not cached, the next screen reads again', async () => {
  const stale = heldList([home]);
  mock.onGet('/saved-places').replyOnce(stale.reply).onGet('/saved-places').reply(200, listBody([home, work]));
  mock.onPost('/saved-places').reply(201, { success: true, data: { place: work, replaced: false } });

  const first = renderHook(() => useSavedPlaces(true));
  await waitFor(() => expect(listGets()).toHaveLength(1));
  await saveSavedPlace({ label: 'work', name: null, address: work.address, lat: work.lat, lng: work.lng, placeId: null }, null);
  await act(async () => {
    stale.release();
  });
  await waitFor(() => expect(first.result.current.places).toHaveLength(1));

  const next = renderHook(() => useSavedPlaces(true));
  await waitFor(() => expect(next.result.current.places).toHaveLength(2));
  expect(listGets()).toHaveLength(2);
});
