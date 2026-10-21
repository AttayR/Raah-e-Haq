/**
 * T-708: the banner and the Drive request sheet share one clock start and one arrival haptic per
 * request; the banner shows only while the Drive tab is not on screen.
 */
import { createOfferSession } from '../../../src/features/driver-requests/offerSession';
import { isDriveTabFocused } from '../../../src/components/driver/DriverRequestLayer';

describe('createOfferSession', () => {
  it('keeps the first clock start of a ride for every later surface', () => {
    const session = createOfferSession();
    expect(session.clockStart(7, 1_000)).toBe(1_000);
    expect(session.clockStart(7, 9_000)).toBe(1_000);
    expect(session.clockStart(8, 9_000)).toBe(9_000);
  });

  it('claims the arrival alert once per ride', () => {
    const session = createOfferSession();
    expect(session.claimAlert(7)).toBe(true);
    expect(session.claimAlert(7)).toBe(false);
    expect(session.claimAlert(8)).toBe(true);
  });

  it('retain forgets rides that left the feed: a re-listed ride starts fresh and alerts again', () => {
    const session = createOfferSession();
    session.clockStart(7, 1_000);
    session.claimAlert(7);
    session.clockStart(8, 2_000);
    session.retain(new Set([8]));
    expect(session.clockStart(7, 50_000)).toBe(50_000);
    expect(session.claimAlert(7)).toBe(true);
    expect(session.clockStart(8, 50_000)).toBe(2_000);
  });

  it('forgets the oldest rides past 200', () => {
    const session = createOfferSession();
    for (let id = 1; id <= 201; id += 1) session.clockStart(id, id);
    expect(session.clockStart(1, 5_000)).toBe(5_000);
    expect(session.clockStart(201, 5_000)).toBe(201);
  });
});

describe('isDriveTabFocused', () => {
  const stack = (top: object, below: object[] = []) => ({ index: below.length, routes: [...below, top] as never });

  it('is true on the tabs with Drive open, or before the tabs have a state of their own', () => {
    expect(isDriveTabFocused(stack({ key: 't', name: 'DriverTabs' }))).toBe(true);
    expect(
      isDriveTabFocused(
        stack({ key: 't', name: 'DriverTabs', state: { key: 'tabs', index: 0, routes: [{ name: 'Drive' }, { name: 'Inbox' }] } }),
      ),
    ).toBe(true);
  });

  it('is false on another tab, on a tab named in the params, or under a stack screen', () => {
    expect(
      isDriveTabFocused(
        stack({ key: 't', name: 'DriverTabs', state: { key: 'tabs', index: 1, routes: [{ name: 'Drive' }, { name: 'Inbox' }] } }),
      ),
    ).toBe(false);
    expect(isDriveTabFocused(stack({ key: 't', name: 'DriverTabs', params: { screen: 'Inbox' } }))).toBe(false);
    expect(isDriveTabFocused(stack({ key: 'p', name: 'Wallet' }, [{ key: 't', name: 'DriverTabs' }]))).toBe(false);
  });
});
