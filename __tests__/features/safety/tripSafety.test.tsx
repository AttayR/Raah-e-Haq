/**
 * T-520: the passenger trip safety tools and SOS sheet, the live trip link, the masked call hook
 * and the PIN card. UI-R12: SOS is the map's Safety shield; Share trip is the PersonCard's third
 * action (useTripShare) with the "You're sharing this trip" dialog and the details' Stop row.
 * - SOS (BE-79): "Call 15" / "Call 1122" are plain tel: links that work with no network and when
 *   the alert fails; "Alert my emergency contacts" confirms first, POSTs /sos once with the
 *   position (a second tap re-opens messages, no second POST) and opens the SMS composer to the
 *   contacts with the server's share message; no contacts → the add-contacts banner.
 * - Share live trip (BE-80): POST /share → the native share sheet with the URL; Stop → DELETE.
 * - Call (BE-78): proxy dials the masked number, chat_only opens the chat, every tap asks again.
 */
import React from 'react';
import { Linking, Platform, Share, StyleSheet } from 'react-native';
import { layout } from '../../../src/theme';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { PassengerSafetyShield } from '../../../src/features/safety/components/RideSafety';
import { useTripShare } from '../../../src/features/active-ride/trip/useTripShare';
import { Button, PersonCard } from '../../../src/components/ui';
import type { RideResource } from '../../../src/services/rideService';
import { RidePinCard } from '../../../src/features/safety/components/RidePinCard';
import { useRideCall } from '../../../src/features/safety/hooks';
import { safetyApi, toCallSession, toShareableUrl, toShareLink, toSosBody, toSosResult } from '../../../src/features/safety/api';
import { canCallOn, isSosAvailable, rideContactOf, ridePinOf, smsUrl } from '../../../src/features/safety/rules';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';
import { makeRide } from '../../../test-utils/rideFixtures';

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const answerDialogs = (yes: boolean) =>
  dialogStore.subscribe(() => {
    const current = dialogStore.getCurrent();
    if (current) dialog.answer(current.id, yes);
  });

const sosBody = (contacts: unknown[] = [{ id: 1, name: 'Ayesha', phone: '+923001234567' }]) => ({
  success: true,
  data: {
    created: true,
    incident: { id: 5, status: 'open', created_at: 'x' },
    emergency_numbers: [
      { key: 'police', label: 'Police', number: '15' },
      { key: 'rescue', label: 'Rescue', number: '1122' },
    ],
    emergency_contacts: contacts,
    share_url: 'https://raahehaq.com/t/abc',
    share_message: 'I need help. Bilal, white Corolla LEA-1234. https://raahehaq.com/t/abc',
  },
});

const ride = makeRide({ id: 41, status: 'started', driver_id: 3, driver: { id: 3, name: 'Bilal' } });
const position = { latitude: 31.5, longitude: 74.3 };

/** The trip sheet's share pieces: the PersonCard's Share cell, its dialog and the details' Stop row. */
function ShareHarness({ ride: r }: { ride: RideResource }) {
  const share = useTripShare(r);
  return (
    <>
      <PersonCard name="Bilal" fallbackName="Your driver" actions={share.action ? [share.action] : []} variant="plain" />
      {share.sharing ? <Button label="Stop" onPress={share.stop} testID="trip-safety-stop-sharing" /> : null}
      {share.dialog}
    </>
  );
}

let mock: MockAdapter;
let openURL: jest.SpyInstance;
let shareSpy: jest.SpyInstance;
let unsubscribe: (() => void) | null = null;

const renderSafety = async (r = ride, store = configureStore({ reducer: rootReducer })) => {
  const utils = render(
    <Provider store={store}>
      <ThemeProvider>
        <PassengerSafetyShield ride={r} position={position} />
        <ShareHarness ride={r} />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
  return { ...utils, store };
};

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  openURL.mockClear();
  shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  jest.spyOn(toast, 'error').mockImplementation(() => '');
  jest.spyOn(toast, 'info').mockImplementation(() => '');
  jest.spyOn(toast, 'success').mockImplementation(() => '');
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  dialog.dismissAll();
  mock.restore();
  jest.restoreAllMocks();
});

describe('SOS sheet', () => {
  it('Call 15 and Call 1122 dial with no request at all (offline works)', async () => {
    mock.onAny().networkError();
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    screen.getByTestId('sos-sheet');
    expect(screen.getByTestId('sos-call-police')).toHaveTextContent(/Call Police 15$/);
    fireEvent.press(screen.getByTestId('sos-call-police'));
    fireEvent.press(screen.getByTestId('sos-call-rescue'));
    expect(openURL.mock.calls.map((c) => c[0])).toEqual(['tel:15', 'tel:1122']);
    expect(mock.history.post).toHaveLength(0);
  });

  it('keeps its content off the screen edges (T-539: the kit sheet body has no side padding)', async () => {
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    expect(StyleSheet.flatten(screen.getByTestId('sos-content').props.style)).toMatchObject({ paddingHorizontal: layout.gutter });
    expect(StyleSheet.flatten(screen.getByTestId('sos-sheet-header').props.children.props.style)).toMatchObject({
      paddingHorizontal: layout.gutter,
    });
  });

  it('a failed alert keeps the call buttons working and says to call', async () => {
    mock.onPost('/rides/41/sos').networkError();
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('sos-alert-contacts'));
    await flush();
    expect(screen.getByTestId('sos-error')).toHaveTextContent(/Call 15 or 1122/);
    fireEvent.press(screen.getByTestId('sos-call-police'));
    expect(openURL).toHaveBeenLastCalledWith('tel:15');
  });

  it('asks before sending; No sends nothing', async () => {
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(false);
    fireEvent.press(screen.getByTestId('sos-alert-contacts'));
    await flush();
    expect(mock.history.post).toHaveLength(0);
  });

  it('Yes sends one SOS with the position, then texts the contacts; a second tap sends no second SOS', async () => {
    mock.onPost('/rides/41/sos').reply(201, sosBody());
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('sos-alert-contacts'));
    await flush();

    const posts = mock.history.post.filter((r) => r.url === '/rides/41/sos');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].data)).toEqual({ latitude: 31.5, longitude: 74.3 });
    const sms = openURL.mock.calls.map((c) => c[0]).find((u: string) => u.startsWith('sms:'));
    expect(sms).toContain('923001234567');
    expect(sms).toContain(encodeURIComponent('I need help.'));
    expect(screen.getByTestId('sos-alert-contacts')).toHaveTextContent(/Alert sent/);

    fireEvent.press(screen.getByTestId('sos-alert-contacts'));
    await flush();
    expect(mock.history.post.filter((r) => r.url === '/rides/41/sos')).toHaveLength(1);
    expect(openURL.mock.calls.filter((c) => String(c[0]).startsWith('sms:'))).toHaveLength(2);
  });

  it("[T-522] Women's safety alert: asks first, then sends category women_safety with the position", async () => {
    mock.onPost('/rides/41/sos').reply(201, sosBody());
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('sos-women-safety'));
    await flush();
    const posts = mock.history.post.filter((r) => r.url === '/rides/41/sos');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0].data)).toEqual({ latitude: 31.5, longitude: 74.3, category: 'women_safety' });
    expect(screen.getByTestId('sos-women-safety')).toHaveTextContent(/Women's-safety alert sent/);
  });

  it("[T-558] Women's safety alert answered 200 created:false says the open alert was upgraded", async () => {
    const body = sosBody();
    mock.onPost('/rides/41/sos').reply(200, {
      ...body,
      message: 'SOS already sent. Our safety team has been alerted.',
      data: { ...body.data, created: false, incident: { id: 5, status: 'open', category: 'women_safety', source: 'sos' } },
    });
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('sos-women-safety'));
    await flush();
    expect(mock.history.post.filter((r) => r.url === '/rides/41/sos')).toHaveLength(1);
    expect(screen.getByTestId('sos-women-safety')).toHaveTextContent(/Alert already sent. It is now a women's-safety case/);
  });

  it('no emergency contacts: the alert is sent and the sheet offers to add contacts', async () => {
    mock.onPost('/rides/41/sos').reply(201, sosBody([]));
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    unsubscribe = answerDialogs(true);
    fireEvent.press(screen.getByTestId('sos-alert-contacts'));
    await flush();
    screen.getByTestId('sos-no-contacts');
    expect(openURL.mock.calls.some((c) => String(c[0]).startsWith('sms:'))).toBe(false);
    fireEvent.press(screen.getByTestId('sos-share-another-way'));
    expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining('I need help.') });
  });

  it('is offered from acceptance until 30 min after the ride ended, never before a driver', async () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(isSosAvailable(makeRide({ status: 'requested' }), now)).toBe(false);
    expect(isSosAvailable(makeRide({ status: 'accepted', driver_id: 3 }), now)).toBe(true);
    expect(isSosAvailable(makeRide({ status: 'completed', completed_at: '2026-10-14T11:40:00Z' }), now)).toBe(true);
    expect(isSosAvailable(makeRide({ status: 'completed', completed_at: '2026-10-14T11:20:00Z' }), now)).toBe(false);
    expect(isSosAvailable(makeRide({ status: 'cancelled', cancelled_at: '2026-10-14T11:50:00Z' }), now)).toBe(false);
    expect(isSosAvailable(makeRide({ status: 'cancelled', driver_id: 3, cancelled_at: '2026-10-14T11:50:00Z' }), now)).toBe(true);
  });
});

describe('Share live trip', () => {
  it('Share trip creates the link and opens the share sheet; Stop sharing revokes it', async () => {
    mock.onPost('/rides/41/share').reply(201, { success: true, data: { url: 'https://raahehaq.com/t/tok', token: 'tok', expires_at: 'x' } });
    mock.onDelete('/rides/41/share').reply(200, { success: true, data: { revoked: 1 } });
    const first = await renderSafety();

    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(shareSpy).toHaveBeenCalledWith({ message: 'Follow my Raah-e-Haq trip live: https://raahehaq.com/t/tok' });
    expect(screen.getByTestId('trip-share-button')).toHaveTextContent(/Sharing$/);
    expect(screen.getByTestId('trip-share-button-dot')).toBeTruthy();
    expect(first.store.getState().activeRide.shareLink).toEqual({ rideId: 41, url: 'https://raahehaq.com/t/tok', expiresAt: 'x' });

    // The link lives in the activeRide slice: a remounted panel still says "Sharing".
    first.unmount();
    await renderSafety(ride, first.store);
    expect(screen.getByTestId('trip-share-button')).toHaveTextContent(/Sharing$/);

    // Sharing → the dialog: "Share link again" opens the share sheet with the same link (no POST).
    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(screen.getByText("You're sharing this trip")).toBeTruthy();
    fireEvent.press(screen.getByTestId('trip-share-again'));
    await flush();
    expect(shareSpy).toHaveBeenCalledTimes(2);
    expect(mock.history.post.filter((r) => r.url === '/rides/41/share')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('trip-safety-stop-sharing'));
    await flush();
    expect(mock.history.delete.map((r) => r.url)).toEqual(['/rides/41/share']);
    expect(screen.queryByTestId('trip-safety-stop-sharing')).toBeNull();
    expect(first.store.getState().activeRide.shareLink).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Trip sharing stopped. The link no longer works.');
  });

  it('an ended ride says it can no longer be shared', async () => {
    mock.onPost('/rides/41/share').reply(409, { success: false, message: 'x', error: { code: 'RIDE_NOT_ACTIVE' } });
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(toast.error).toHaveBeenCalledWith('This ride has ended, so it can no longer be shared.');
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('a local http link works in a Debug build (T-539): the share sheet opens', async () => {
    mock.onPost('/rides/41/share').reply(201, { success: true, data: { url: 'http://127.0.0.1:8000/t/tok', token: 'tok', expires_at: 'x' } });
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(shareSpy).toHaveBeenCalledWith({ message: 'Follow my Raah-e-Haq trip live: http://127.0.0.1:8000/t/tok' });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('an unusable link says so (never a silent tap) and opens no share sheet (T-539)', async () => {
    mock.onPost('/rides/41/share').reply(201, { success: true, data: { url: 'http://example.com/t/tok', token: 'tok', expires_at: 'x' } });
    const { store } = await renderSafety();
    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Couldn't create a trip link. Please try again.");
    expect(shareSpy).not.toHaveBeenCalled();
    expect(store.getState().activeRide.shareLink).toBeNull();
  });

  it('a share sheet that cannot open says so (T-539)', async () => {
    mock.onPost('/rides/41/share').reply(201, { success: true, data: { url: 'https://raahehaq.com/t/tok', token: 'tok', expires_at: 'x' } });
    shareSpy.mockRejectedValueOnce(new Error('no activity'));
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-share-button'));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Couldn't open sharing on this phone. Please try again.");
  });

  it('a failed share from the SOS sheet says so too', async () => {
    mock.onPost('/rides/41/share').reply(500, { success: false, message: 'x' });
    await renderSafety();
    fireEvent.press(screen.getByTestId('trip-safety-sos'));
    await flush();
    fireEvent.press(screen.getByTestId('sos-share-trip'));
    await flush();
    expect(toast.error).toHaveBeenCalledWith("Couldn't create a trip link. Please try again.");
  });

  it('is not offered after the ride (SOS still is)', async () => {
    await renderSafety(makeRide({ id: 41, status: 'completed', driver_id: 3, completed_at: new Date().toISOString() }));
    screen.getByTestId('trip-safety-sos');
    expect(screen.queryByTestId('trip-share-button')).toBeNull();
  });
});

describe('useRideCall', () => {
  it('proxy: dials the masked number; every tap asks POST /call again (a revoked number is never redialled)', async () => {
    const requestCall = jest
      .spyOn(safetyApi, 'requestCall')
      .mockResolvedValueOnce({ mode: 'proxy', number: '+922100000001', expiresAt: null, contactClosesAt: null })
      .mockResolvedValueOnce({ mode: 'proxy', number: '+922100000002', expiresAt: null, contactClosesAt: null });
    const { result } = renderHook(() => useRideCall(41));
    await act(async () => {
      await result.current.call();
    });
    await act(async () => {
      await result.current.call();
    });
    expect(requestCall).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls.map((c) => c[0])).toEqual(['tel:%2B922100000001', 'tel:%2B922100000002']);
  });

  it('chat_only: opens the chat with a note and dials nothing', async () => {
    jest.spyOn(safetyApi, 'requestCall').mockResolvedValue({ mode: 'chat_only', contactClosesAt: null });
    const onChatOnly = jest.fn();
    const { result } = renderHook(() => useRideCall(41, { onChatOnly }));
    await act(async () => {
      await result.current.call();
    });
    expect(onChatOnly).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith("Calls aren't available right now. Send a message instead.", undefined, undefined);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('a double tap sends one request; CONTACT_CLOSED says calling has closed', async () => {
    mock.onPost('/rides/41/call').reply(403, { success: false, message: 'closed', error: { code: 'CONTACT_CLOSED' } });
    const { result } = renderHook(() => useRideCall(41));
    await act(async () => {
      await Promise.all([result.current.call(), result.current.call()]);
    });
    expect(mock.history.post).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith('Calling has closed for this ride.', undefined, undefined);
  });
});

describe('safety mappers and rules', () => {
  it('maps the call answer; a proxy without a usable number is chat only', () => {
    expect(toCallSession({ mode: 'proxy', number: '+92 21 0000 0001', expires_at: 'e' })).toEqual({
      mode: 'proxy',
      number: '+922100000001',
      expiresAt: 'e',
      contactClosesAt: null,
    });
    expect(toCallSession({ mode: 'proxy', number: '+9221;ext=1' })).toEqual({ mode: 'chat_only', contactClosesAt: null });
    expect(toCallSession({ mode: 'chat_only', contact_closes_at: 'c' })).toEqual({ mode: 'chat_only', contactClosesAt: 'c' });
  });

  it('maps the SOS answer, keeping the 15 / 1122 fallback and only https share links', () => {
    const result = toSosResult({ ...sosBody().data, emergency_numbers: [], share_url: ['javascript', 'alert(1)'].join(':') });
    expect(result.emergencyNumbers.map((n) => n.number)).toEqual(['15', '1122']);
    expect(result.shareUrl).toBeNull();
    expect(result.emergencyContacts).toEqual([{ id: 1, name: 'Ayesha', phone: '+923001234567' }]);
    expect(toSosBody(null)).toEqual({});
    expect(toSosBody({ latitude: 31.5, longitude: 74.3, accuracy: 12 })).toEqual({ latitude: 31.5, longitude: 74.3, accuracy: 12 });
  });

  it('shares https anywhere; plain http only to the local backend and only in a Debug build (T-539)', () => {
    // Release: https only.
    expect(toShareableUrl('https://raahehaq.com/t/abc', false)).toBe('https://raahehaq.com/t/abc');
    expect(toShareableUrl('http://127.0.0.1:8000/t/abc', false)).toBeNull();
    expect(toShareableUrl('http://localhost:8000/t/abc', false)).toBeNull();
    // Debug: the local backend's hosts only.
    expect(toShareableUrl('http://127.0.0.1:8000/t/abc', true)).toBe('http://127.0.0.1:8000/t/abc');
    expect(toShareableUrl(' http://localhost/t/abc ', true)).toBe('http://localhost/t/abc');
    expect(toShareableUrl('http://10.0.2.2:8000/t/abc', true)).toBe('http://10.0.2.2:8000/t/abc');
    expect(toShareableUrl('http://raahehaq.com/t/abc', true)).toBeNull();
    expect(toShareableUrl('http://localhost.evil.com/t/abc', true)).toBeNull();
    expect(toShareableUrl('http://user@localhost/t', true)).toBeNull();
    expect(toShareableUrl(['javascript', 'alert(1)'].join(':'), true)).toBeNull();
    expect(toShareableUrl('https://raahehaq.com/t/a b', true)).toBeNull();
    expect(toShareableUrl(42, true)).toBeNull();
    expect(() => toShareLink({ url: 'ftp://raahehaq.com/t' })).toThrow('Invalid share link response');
  });

  it('reads contact and the PIN only from the server fields', () => {
    expect(rideContactOf(makeRide({}))).toBeNull();
    expect(canCallOn(makeRide({ contact: { can_chat: true, can_call: true, call_mode: 'proxy' } }))).toBe(true);
    expect(canCallOn(makeRide({ contact: { can_chat: true, can_call: true, call_mode: 'chat_only' } }))).toBe(false);
    expect(ridePinOf(makeRide({ status: 'accepted', pin: '0427' }))).toBe('0427');
    expect(ridePinOf(makeRide({ status: 'started', pin: '0427' }))).toBeNull();
    expect(ridePinOf(makeRide({ status: 'arrived', pin: '42' }))).toBeNull();
  });

  it('builds the SMS link per platform', () => {
    expect(smsUrl(['+923001234567', '+923211234567'], 'Help me', 'ios')).toBe('sms:/open?addresses=+923001234567,+923211234567&body=Help%20me');
    expect(smsUrl(['+923001234567'], 'Help me', 'android')).toBe('sms:+923001234567?body=Help%20me');
    expect(Platform.OS).toBeTruthy();
  });

  it('the PIN card shows the 4 digits with the hint and reads them one by one', async () => {
    render(
      <ThemeProvider>
        <RidePinCard pin="0427" />
      </ThemeProvider>,
    );
    await flush();
    expect(screen.getByTestId('ride-pin-card-hint')).toHaveTextContent('Share this PIN with your driver');
    expect(screen.getByTestId('ride-pin-card-digit-0', { includeHiddenElements: true })).toHaveTextContent('0');
    expect(screen.getByTestId('ride-pin-card-digit-3', { includeHiddenElements: true })).toHaveTextContent('7');
    expect(screen.getByTestId('ride-pin-card').props.accessibilityLabel).toBe(
      'Your ride PIN is 0 4 2 7. Tell it to your driver when you get in.',
    );
  });
});
