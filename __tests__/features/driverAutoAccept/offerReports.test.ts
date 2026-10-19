/**
 * T-587 (BE-116, map-vehicles.md §7.4): offer-viewed / offer-declined are sent once per ride,
 * fire-and-forget: silent on 404 (and any 4xx), one retry after a network error, never a loop.
 */
import { ApiError } from '../../../src/core/api/errors';
import { autoAcceptApi } from '../../../src/features/driver-auto-accept/api';
import {
  OFFER_RETRY_DELAY_MS,
  __resetOfferReportsForTests,
  reportOfferDeclined,
  reportOfferViewed,
} from '../../../src/features/driver-auto-accept/offerReports';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetOfferReportsForTests();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('offer reports', () => {
  it('sends offer-viewed once per ride', async () => {
    const viewed = jest.spyOn(autoAcceptApi, 'offerViewed').mockResolvedValue();
    reportOfferViewed(7);
    reportOfferViewed(7);
    reportOfferViewed(8);
    await flush();
    expect(viewed.mock.calls).toEqual([[7], [8]]);
  });

  it('drops a 404 OFFER_NOT_FOUND silently, without a retry', async () => {
    const declined = jest
      .spyOn(autoAcceptApi, 'offerDeclined')
      .mockRejectedValue(new ApiError({ kind: 'not_found', status: 404, code: 'OFFER_NOT_FOUND', message: 'Not found.' }));
    reportOfferDeclined(7);
    await flush();
    jest.advanceTimersByTime(OFFER_RETRY_DELAY_MS * 5);
    await flush();
    expect(declined).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure once, and only once', async () => {
    const viewed = jest
      .spyOn(autoAcceptApi, 'offerViewed')
      .mockRejectedValue(new ApiError({ kind: 'network', message: 'offline' }));
    reportOfferViewed(9);
    await flush();
    expect(viewed).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(OFFER_RETRY_DELAY_MS);
    await flush();
    expect(viewed).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(OFFER_RETRY_DELAY_MS * 10);
    await flush();
    expect(viewed).toHaveBeenCalledTimes(2);
  });

  it('drops the retry when the session ended meanwhile (sign-out)', async () => {
    const viewed = jest
      .spyOn(autoAcceptApi, 'offerViewed')
      .mockRejectedValue(new ApiError({ kind: 'network', message: 'offline' }));
    reportOfferViewed(10);
    await flush();
    bumpSessionEpoch();
    jest.advanceTimersByTime(OFFER_RETRY_DELAY_MS * 3);
    await flush();
    expect(viewed).toHaveBeenCalledTimes(1);
  });
});
