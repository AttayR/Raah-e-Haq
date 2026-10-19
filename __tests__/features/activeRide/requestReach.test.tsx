/**
 * T-587 (passenger half): the reach strip on Finding a driver. `reach: {sent, viewing}` from the
 * ride poll (no request of its own); "Sent to {n} drivers · {m} viewing" in English and Roman
 * Urdu; "Sending to drivers nearby…" for 0 or hidden (women mode) counts; viewing clamped to
 * sent; a reply without reach keeps the last value, none hides it; announced once each.
 */
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import ActiveRidePanel from '../../../src/features/active-ride/components/ActiveRidePanel';
import { RequestReachStrip } from '../../../src/features/active-ride/components/RequestReachStrip';
import { reachContent, reachOf } from '../../../src/features/active-ride/reach';
import { advanceRideStage } from '../../../src/features/active-ride/stage';
import { setLocale } from '../../../src/i18n';
import type { RideResource } from '../../../src/services/rideService';
import { makeRide } from '../../../test-utils/rideFixtures';

const searchingRide = (reach?: unknown, over: Partial<RideResource> = {}): RideResource =>
  makeRide({ status: 'requested', requested_at: new Date().toISOString(), ...(reach === undefined ? {} : { reach }), ...over });

afterEach(() => {
  act(() => setLocale('en'));
  jest.restoreAllMocks();
});

describe('reach model', () => {
  it('reads counts, clamps viewing to sent, and keeps hidden (women mode) counts as null', () => {
    expect(reachOf(searchingRide())).toBeNull();
    expect(reachOf(searchingRide('x'))).toBeNull();
    expect(reachOf(searchingRide({ sent: 6, viewing: 2 }))).toEqual({ sent: 6, viewing: 2 });
    expect(reachOf(searchingRide({ sent: '3', viewing: 9 }))).toEqual({ sent: 3, viewing: 3 });
    expect(reachOf(searchingRide({ sent: null, viewing: null }))).toEqual({ sent: null, viewing: null });
    expect(reachOf(searchingRide({ sent: 4 }))).toEqual({ sent: 4, viewing: 0 });
  });

  it('English copy per state', () => {
    expect(reachContent({ sent: null, viewing: null }).label).toBe('Sending to drivers nearby…');
    expect(reachContent({ sent: 0, viewing: 0 }).label).toBe('Sending to drivers nearby…');
    expect(reachContent({ sent: 1, viewing: 0 }).label).toBe('Sent to 1 driver');
    expect(reachContent({ sent: 8, viewing: 0 }).label).toBe('Sent to 8 drivers');
    expect(reachContent({ sent: 8, viewing: 1 }).label).toBe('Sent to 8 drivers · 1 viewing');
    expect(reachContent({ sent: 8, viewing: 3 }).label).toBe('Sent to 8 drivers · 3 viewing');
  });

  it('Roman Urdu copy per state', () => {
    act(() => setLocale('ur-Latn'));
    expect(reachContent({ sent: 0, viewing: 0 }).label).toBe('Qareeb drivers ko bhej rahe hain…');
    expect(reachContent({ sent: 1, viewing: 0 }).label).toBe('1 driver ko bheji gayi');
    expect(reachContent({ sent: 8, viewing: 0 }).label).toBe('8 drivers ko bheji gayi');
    expect(reachContent({ sent: 8, viewing: 1 }).label).toBe('8 drivers ko bheji gayi · 1 dekh raha hai');
    expect(reachContent({ sent: 8, viewing: 3 }).label).toBe('8 drivers ko bheji gayi · 3 dekh rahe hain');
  });
});

describe('RequestReachStrip', () => {
  it('in the searching panel: one text element labelled with the visible text, the viewing dot only while viewing', () => {
    const ride = searchingRide({ sent: 6, viewing: 0 });
    const state = advanceRideStage(null, ride);
    if (!state) throw new Error('no stage');
    const { rerender } = render(<ActiveRidePanel stageState={state} ride={ride} onCancel={jest.fn()} />);
    const strip = screen.getByTestId('request-reach');
    expect(strip.props.accessibilityLabel).toBe('Sent to 6 drivers');
    expect(strip.props.accessibilityRole).toBe('text');
    expect(screen.getByTestId('request-reach-sent-n')).toHaveTextContent('6');
    expect(screen.queryByTestId('request-reach-dot')).toBeNull();
    const viewed = searchingRide({ sent: 7, viewing: 2 }, { id: ride.id });
    rerender(<ActiveRidePanel stageState={state} ride={viewed} onCancel={jest.fn()} />);
    expect(screen.getByTestId('request-reach').props.accessibilityLabel).toBe('Sent to 7 drivers · 2 viewing');
    expect(screen.getByTestId('request-reach-dot')).toBeTruthy();
    expect(screen.getByTestId('request-reach-viewing-n')).toHaveTextContent('2');
  });

  it('hidden until a poll carries reach; a reply without it keeps the last value; a new round restarts', () => {
    const { rerender } = render(<RequestReachStrip ride={searchingRide()} searching />);
    expect(screen.queryByTestId('request-reach')).toBeNull();
    const ride = searchingRide({ sent: 5, viewing: 1 });
    rerender(<RequestReachStrip ride={ride} searching />);
    expect(screen.getByTestId('request-reach').props.accessibilityLabel).toBe('Sent to 5 drivers · 1 viewing');
    // The next reply has no reach (a failed read keeps the ride; an older reply shape): silent, kept.
    rerender(<RequestReachStrip ride={{ ...ride, reach: undefined }} searching />);
    expect(screen.getByTestId('request-reach').props.accessibilityLabel).toBe('Sent to 5 drivers · 1 viewing');
    // Re-queued after a driver cancel (T-546): a new round, the server's new counts only.
    rerender(<RequestReachStrip ride={{ ...ride, reach: undefined, requeue_count: 1 }} searching />);
    expect(screen.queryByTestId('request-reach')).toBeNull();
    // Not searching (a driver took it, or no driver found): gone.
    rerender(<RequestReachStrip ride={ride} searching={false} />);
    expect(screen.queryByTestId('request-reach')).toBeNull();
  });

  it('women mode (null counts): "Sending to drivers nearby…", no numbers', () => {
    render(<RequestReachStrip ride={searchingRide({ sent: null, viewing: null })} searching />);
    expect(screen.getByTestId('request-reach-sending')).toHaveTextContent('Sending to drivers nearby…');
    expect(screen.queryByTestId('request-reach-sent-n')).toBeNull();
  });

  it('announces when sent, then viewing, first becomes > 0, not on every change', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    announce.mockClear();
    const ride = searchingRide({ sent: 0, viewing: 0 });
    const { rerender } = render(<RequestReachStrip ride={ride} searching />);
    expect(announce).not.toHaveBeenCalled();
    rerender(<RequestReachStrip ride={{ ...ride, reach: { sent: 4, viewing: 0 } }} searching />);
    rerender(<RequestReachStrip ride={{ ...ride, reach: { sent: 6, viewing: 0 } }} searching />);
    rerender(<RequestReachStrip ride={{ ...ride, reach: { sent: 6, viewing: 1 } }} searching />);
    rerender(<RequestReachStrip ride={{ ...ride, reach: { sent: 6, viewing: 2 } }} searching />);
    expect(announce.mock.calls.map(c => c[0])).toEqual(['Your request was sent to 4 drivers.', '1 driver is viewing it.']);
  });
});
