import { apiService, type ApiResponse } from '../../services/api';
import { currentSessionEpoch } from '../../store/sessionEpoch';
import { CACHE_NAMES, CACHE_TTL, cacheVersion, invalidateCache, readCache, writeCache } from './queryCache';

/**
 * GET /settings/public, read once per session and shared (T-406): its `data` rows feed Help &
 * support (contacts, legal links) and its `meta.realtime` the realtime connection. The whole
 * body is kept in the session's query cache; parallel callers share one request.
 */
type Body = ApiResponse<unknown>;

let inFlight: { promise: Promise<Body>; epoch: number } | null = null;

export const readPublicSettings = (): Promise<Body> => {
  const cached = readCache<Body>(CACHE_NAMES.publicSettingsBody, CACHE_TTL.publicSettings);
  if (cached) return Promise.resolve(cached.value);
  const epoch = currentSessionEpoch();
  if (inFlight && inFlight.epoch === epoch) return inFlight.promise;
  const since = cacheVersion(CACHE_NAMES.publicSettingsBody);
  const promise = apiService.get<unknown>('/settings/public').then((body) => {
    writeCache(CACHE_NAMES.publicSettingsBody, body, since);
    return body;
  });
  const entry = { promise, epoch };
  inFlight = entry;
  const done = () => {
    if (inFlight === entry) inFlight = null;
  };
  promise.then(done, done);
  return promise;
};

/** Pull to refresh: the next read asks the server again. */
export const invalidatePublicSettings = (): void => {
  invalidateCache(CACHE_NAMES.publicSettingsBody);
  inFlight = null;
};
