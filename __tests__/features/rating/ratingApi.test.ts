/**
 * T-505 (BE-07): rating tags and ride rating fields are mapped from the contract in one place;
 * the tags offered follow the star bands; the POST body sends `stars` as a JSON integer; 409
 * ALREADY_RATED and 422 RATING_WINDOW_CLOSED are "stale" (close quietly), everything else is an
 * inline message; GET /rating-tags is fetched once per session.
 */
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '../../../src/services/api';
import {
  RATING_DEFAULTS,
  ratingApi,
  toMyRating,
  toRateBody,
  toRatingConfig,
  toRideRatingFields,
  toRideRatingState,
} from '../../../src/features/rating/api';
import { classifyRateFailure, keepAllowedTags, tagLabels, tagsForStars, toggleTag } from '../../../src/features/rating/format';
import { loadRatingConfig, resetRatingSessionState } from '../../../src/features/rating/hooks';
import { toApiError } from '../../../src/core/api/errors';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';
import { toRide } from '../../../src/features/ride-history/api';

/** GET /rating-tags `data` (fake local values). */
const rawTags = (overrides: Record<string, unknown> = {}) => ({
  window_days: 7,
  max_tags: 3,
  max_comment_length: 500,
  positive_min_stars: 4,
  negative_max_stars: 4,
  tags: {
    passenger: {
      positive: [
        { key: 'clean_car', label: 'Clean car' },
        { key: 'safe_driving', label: 'Safe driving' },
        { key: 'friendly', label: 'Friendly' },
        { key: 'on_time', label: 'On time' },
      ],
      negative: [
        { key: 'rude', label: 'Rude' },
        { key: 'late', label: 'Late' },
      ],
    },
    driver: {
      positive: [{ key: 'polite', label: 'Polite' }],
      negative: [{ key: 'no_show_late', label: 'Kept me waiting' }],
    },
  },
  ...overrides,
});

const config = toRatingConfig(rawTags());

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  resetRatingSessionState();
});

afterEach(() => {
  mock.restore();
});

/** An ApiError as the axios interceptor builds it from a response. */
const responseError = (status: number, data: unknown) =>
  toApiError(Object.assign(new Error('x'), { isAxiosError: true, response: { status, data, headers: {} }, config: {} }));

describe('mapping', () => {
  it('maps GET /rating-tags: limits, bands per rater role, invalid tags and duplicates dropped', () => {
    const mapped = toRatingConfig(
      rawTags({
        tags: {
          passenger: { positive: [{ key: 'a', label: 'A' }, { key: 'a', label: 'A again' }, { key: '', label: 'x' }, 'junk'], negative: null },
        },
      }),
    );
    expect(mapped).toMatchObject({ windowDays: 7, maxTags: 3, maxCommentLength: 500, positiveMinStars: 4, negativeMaxStars: 4 });
    expect(mapped.tags.passenger).toEqual({ positive: [{ key: 'a', label: 'A' }], negative: [] });
    expect(mapped.tags.driver).toEqual({ positive: [], negative: [] });
  });

  it('falls back to the contract limits when the server leaves them out', () => {
    expect(toRatingConfig({})).toMatchObject({ maxTags: RATING_DEFAULTS.maxTags, maxCommentLength: 500, positiveMinStars: 4 });
  });

  it('reads my_rating and can_rate off a ride; a rated ride is never ratable', () => {
    expect(toMyRating({ stars: 5, tags: ['clean_car'], comment: 'Great', created_at: '2026-10-13T12:00:00Z' })).toEqual({
      stars: 5,
      tags: ['clean_car'],
      comment: 'Great',
      createdAt: '2026-10-13T12:00:00Z',
    });
    expect(toMyRating({ stars: 0 })).toBeNull();
    expect(toMyRating({ stars: 4.5 })).toBeNull();
    expect(toRideRatingState({ my_rating: null, can_rate: true })).toEqual({ myRating: null, canRate: true });
    expect(toRideRatingState({ my_rating: { stars: 3, tags: [] }, can_rate: true }).canRate).toBe(false);
    expect(toRideRatingState({})).toEqual({ myRating: null, canRate: false });
    expect(toRideRatingFields({ myRating: { stars: 4, tags: ['x'], comment: null, createdAt: null }, canRate: false })).toEqual({
      my_rating: { stars: 4, tags: ['x'], comment: null, created_at: null },
      can_rate: false,
    });
  });

  it('ride history rides carry the rating fields', () => {
    const ride = toRide({ id: 9, status: 'completed', my_rating: { stars: 2, tags: ['late'], comment: null }, can_rate: false });
    expect(ride?.myRating).toMatchObject({ stars: 2, tags: ['late'] });
    expect(ride?.canRate).toBe(false);
    expect(toRide({ id: 9, status: 'completed', can_rate: true })?.canRate).toBe(true);
  });
});

describe('BE-107 parcel tags (T-569)', () => {
  const parcelTags = {
    passenger: {
      positive: [
        { key: 'careful_handling', label: 'Handled with care' },
        { key: 'on_time', label: 'On time' },
      ],
      negative: [{ key: 'item_damaged', label: 'Item damaged' }],
    },
    driver: {
      positive: [{ key: 'ready_at_pickup', label: 'Ready at pickup' }],
      negative: [{ key: 'poorly_packed', label: 'Poorly packed' }],
    },
  };
  const withParcel = toRatingConfig(rawTags({ parcel_tags: parcelTags }));
  const keys = (cfg: typeof config, role: 'passenger' | 'driver', stars: number, parcel: boolean) =>
    tagsForStars(cfg, role, stars, parcel).map((tag) => tag.key);

  it('maps data.parcel_tags per rater role; absent parcel_tags is null', () => {
    expect(withParcel.parcelTags?.passenger.positive.map((tag) => tag.key)).toEqual(['careful_handling', 'on_time']);
    expect(withParcel.parcelTags?.driver).toEqual({
      positive: [{ key: 'ready_at_pickup', label: 'Ready at pickup' }],
      negative: [{ key: 'poorly_packed', label: 'Poorly packed' }],
    });
    expect(config.parcelTags).toBeNull();
  });

  it('a parcel ride offers only parcel keys: sender rates the rider, rider rates the sender', () => {
    expect(keys(withParcel, 'passenger', 4, true)).toEqual(['careful_handling', 'on_time', 'item_damaged']);
    expect(keys(withParcel, 'driver', 5, true)).toEqual(['ready_at_pickup']);
    expect(keys(withParcel, 'driver', 2, true)).toEqual(['poorly_packed']);
  });

  it('a normal ride keeps the ride tags even when parcel_tags exist', () => {
    expect(keys(withParcel, 'passenger', 5, false)).toEqual(['clean_car', 'safe_driving', 'friendly', 'on_time']);
    expect(keys(withParcel, 'driver', 5, false)).toEqual(['polite']);
  });

  it('an older server without parcel_tags: a parcel ride falls back to the ride tags', () => {
    expect(keys(config, 'passenger', 5, true)).toEqual(['clean_car', 'safe_driving', 'friendly', 'on_time']);
  });

  it('labels a parcel rating from the parcel lists', () => {
    expect(tagLabels(withParcel, 'passenger', ['careful_handling', 'item_damaged'], true)).toEqual(['Handled with care', 'Item damaged']);
    expect(tagLabels(withParcel, 'passenger', ['careful_handling', 'clean_car'])).toEqual(['Clean car']);
  });

  it('[T-571] a parcel rating made with ride tag keys (builds before T-569) still shows their labels', () => {
    // Before T-571 the ride keys were dropped: the sender saw only part of what they had picked.
    expect(tagLabels(withParcel, 'passenger', ['careful_handling', 'clean_car', 'rude'], true)).toEqual([
      'Handled with care',
      'Clean car',
      'Rude',
    ]);
    expect(tagLabels(withParcel, 'driver', ['polite', 'poorly_packed', 'gone'], true)).toEqual(['Polite', 'Poorly packed']);
  });

  it('[T-571] a key on both lists takes the parcel label on a parcel ride', () => {
    const shared = toRatingConfig(
      rawTags({
        parcel_tags: {
          ...parcelTags,
          passenger: { positive: [{ key: 'on_time', label: 'Delivered on time' }], negative: [] },
        },
      }),
    );
    expect(tagLabels(shared, 'passenger', ['on_time'], true)).toEqual(['Delivered on time']);
    expect(tagLabels(shared, 'passenger', ['on_time'])).toEqual(['On time']);
  });
});

describe('star bands and tags', () => {
  const keys = (stars: number, role: 'passenger' | 'driver' = 'passenger') => tagsForStars(config, role, stars).map((tag) => tag.key);

  it('5 stars: positive only; 4: both bands; 1-3: negative only; none without stars', () => {
    expect(keys(5)).toEqual(['clean_car', 'safe_driving', 'friendly', 'on_time']);
    expect(keys(4)).toEqual(['clean_car', 'safe_driving', 'friendly', 'on_time', 'rude', 'late']);
    expect(keys(2)).toEqual(['rude', 'late']);
    expect(keys(0)).toEqual([]);
    expect(tagsForStars(null, 'passenger', 5)).toEqual([]);
  });

  it('uses the rater role: a driver gets the driver list', () => {
    expect(keys(5, 'driver')).toEqual(['polite']);
  });

  it('toggles tags up to max_tags; a band change drops tags it no longer offers', () => {
    let selected = toggleTag([], 'a', 2);
    selected = toggleTag(selected, 'b', 2);
    expect(toggleTag(selected, 'c', 2)).toEqual(['a', 'b']);
    expect(toggleTag(selected, 'a', 2)).toEqual(['b']);
    expect(keepAllowedTags(['clean_car', 'rude'], tagsForStars(config, 'passenger', 2))).toEqual(['rude']);
  });

  it('labels come from the server list; unknown keys are left out', () => {
    expect(tagLabels(config, 'passenger', ['late', 'gone', 'clean_car'])).toEqual(['Late', 'Clean car']);
    expect(tagLabels(null, 'passenger', ['late'])).toEqual([]);
  });
});

describe('POST /rides/{id}/rate', () => {
  it('sends stars as a JSON integer, tags only when chosen, a trimmed comment only when not blank', async () => {
    expect(toRateBody(5, [], '   ')).toEqual({ stars: 5 });
    expect(toRateBody(4, ['clean_car'], '  Great ride \n')).toEqual({ stars: 4, tags: ['clean_car'], comment: 'Great ride' });

    mock.onPost('/rides/12/rate').reply(201, {
      success: true,
      data: { my_rating: { stars: 4, tags: ['clean_car'], comment: 'Great ride', created_at: '2026-10-13T12:00:00Z' }, can_rate: false },
    });
    const state = await ratingApi.rate(12, toRateBody(4, ['clean_car'], 'Great ride'));
    expect(state).toEqual({ myRating: expect.objectContaining({ stars: 4 }), canRate: false });
    const sent = mock.history.post[0].data;
    expect(sent).toBe('{"stars":4,"tags":["clean_car"],"comment":"Great ride"}');
    expect(typeof JSON.parse(sent).stars).toBe('number');
  });

  it('409 ALREADY_RATED and 422 RATING_WINDOW_CLOSED are stale; other refusals are messages', () => {
    expect(classifyRateFailure(responseError(409, { success: false, message: 'x', error: { code: 'ALREADY_RATED' } }))).toEqual({ kind: 'stale' });
    expect(classifyRateFailure(responseError(422, { success: false, message: 'x', error: { code: 'RATING_WINDOW_CLOSED' } }))).toEqual({ kind: 'stale' });
    expect(classifyRateFailure(responseError(422, { success: false, message: 'x', error: { code: 'RIDE_NOT_COMPLETED' } }))).toEqual({
      kind: 'message',
      message: 'You can rate this trip once it is complete.',
    });
    expect(classifyRateFailure(responseError(422, { success: false, message: 'Invalid', errors: { tags: ['That tag is not allowed.'] } }))).toEqual({
      kind: 'message',
      message: 'That tag is not allowed.',
    });
    expect(classifyRateFailure(responseError(500, { message: 'SQLSTATE secret' }))).toEqual({
      kind: 'message',
      message: 'Something went wrong on our side. Please try again.',
    });
  });
});

describe('GET /rating-tags session cache', () => {
  it('asks once per session; a failure is not cached; a new session asks again', async () => {
    mock.onGet('/rating-tags').replyOnce(500, {}).onGet('/rating-tags').reply(200, { success: true, data: rawTags() });
    await expect(loadRatingConfig()).rejects.toBeTruthy();
    const first = await loadRatingConfig();
    const again = await loadRatingConfig();
    expect(again).toBe(first);
    expect(mock.history.get).toHaveLength(2);
    bumpSessionEpoch();
    await loadRatingConfig();
    expect(mock.history.get).toHaveLength(3);
  });
});
