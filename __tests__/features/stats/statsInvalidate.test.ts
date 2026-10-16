/**
 * T-536: a ride that ends (passenger poll or cancel, driver complete) drops the cached
 * GET /me/stats, so Activity / Drive show the new numbers on their next focus.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import { CACHE_NAMES, CACHE_TTL, readCache, writeCache } from '../../../src/core/api/queryCache';
import { createActiveRide, refreshActiveRide } from '../../../src/features/active-ride/slice';
import { invalidateStatsForRide } from '../../../src/features/stats/invalidate';
import { envelope, makeRide, makeRideRequest, makeStore } from '../../../test-utils/rideFixtures';

const STATS_KEY = `${CACHE_NAMES.stats}|`;
const statsCached = () => readCache(STATS_KEY, CACHE_TTL.stats) !== null;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
});
afterEach(() => {
  mock.restore();
});

it('only a final status drops the stats', () => {
  writeCache(STATS_KEY, { rides: 1 });
  invalidateStatsForRide({ status: 'started' });
  expect(statsCached()).toBe(true);
  invalidateStatsForRide({ status: 'completed' });
  expect(statsCached()).toBe(false);
  writeCache(STATS_KEY, { rides: 1 });
  invalidateStatsForRide({ status: 'cancelled' });
  expect(statsCached()).toBe(false);
});

it('the passenger poll that sees the ride completed drops the stats', async () => {
  const store = makeStore();
  store.dispatch(createActiveRide.fulfilled(makeRide({ id: 21, status: 'started' }), 'req', makeRideRequest()));
  writeCache(STATS_KEY, { rides: 1 });
  mock.onGet('/rides/21').replyOnce(200, envelope(makeRide({ id: 21, status: 'started' }))).onGet('/rides/21').reply(200, envelope(makeRide({ id: 21, status: 'completed' })));

  await store.dispatch(refreshActiveRide(21));
  expect(statsCached()).toBe(true);
  await store.dispatch(refreshActiveRide(21));
  expect(statsCached()).toBe(false);
});
