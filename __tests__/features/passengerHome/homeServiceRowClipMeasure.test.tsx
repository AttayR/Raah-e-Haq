/**
 * Home service row: the natural height is never read from a row squeezed by its own clip
 * (bug: after a ride, Done on the receipt landed on Home with the Ride / Parcel row stuck at 12pt,
 * the cards clipped under the chips, and the sheet's peek wrong until a relaunch).
 *
 * Device trace (passenger sim, 2026-10-21, temporary onLayout probes):
 *   ride goes live → hide → the clip shrinks 84 → 0; at clip 8.6 the row reported 12 (its bottom
 *   padding) with both card slots at 0, so the "natural" height became 12;
 *   ride ends → show → the clip grew to 12 and settled at 12; inside a 12pt clip the row keeps
 *   measuring 12, so it never recovers.
 *
 * `rowLayout` models what Yoga hands the row's onLayout: in flow, the row is squeezed to the
 * clip's current height (never below its 12pt padding); out of flow (absolutely positioned
 * content) it gets its own height whatever the clip is.
 */
import React from 'react';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HomeServiceRow } from '../../../src/features/passenger-home/components/HomeServiceRow';
import { HOME_SERVICE_ROW_ESTIMATE } from '../../../src/features/passenger-home/layout';

type Done = (finished?: boolean) => void;
type Call = { to: number; done?: Done };

const NATURAL = 84;
const PADDING = 12;

let calls: Call[] = [];
/** When set, an animation's value is this frame (mid-animation) instead of its end value. */
let midFrame: number | null = null;

function useStableSharedValue<T>(init: T) {
  const ref = React.useRef<{ value: T } | null>(null);
  if (ref.current === null) ref.current = { value: init };
  return ref.current;
}

beforeEach(() => {
  calls = [];
  midFrame = null;
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(useStableSharedValue as unknown as typeof Reanimated.useSharedValue);
  jest.spyOn(Reanimated, 'withTiming').mockImplementation(((to: number, _config: unknown, done?: Done) => {
    calls.push({ to, done });
    return midFrame ?? to;
  }) as typeof Reanimated.withTiming);
});

afterEach(() => jest.restoreAllMocks());

const pending = (pick: (c: Call) => boolean) => {
  const found = calls.filter(c => c.done && pick(c));
  return found[found.length - 1]?.done as Done;
};

function setup() {
  const onHeight = jest.fn();
  let n = 0;
  const ui = (visible: boolean) => {
    n += 1;
    // A fresh onRide defeats memo, so the animated style is re-read (a mapper run on device).
    return <HomeServiceRow visible={visible} onRide={() => n} onParcel={jest.fn()} onShown={jest.fn()} onHeight={onHeight} />;
  };
  const view = render(ui(true));
  const clipHeight = () => {
    const wrap = screen.queryByTestId('home-service-row-wrap');
    return wrap ? (StyleSheet.flatten(wrap.props.style) as ViewStyle).height : undefined;
  };
  /** Yoga's layout pass: fires the row's onLayout with what the native row would measure. */
  const layoutPass = () => {
    const row = screen.queryByTestId('home-service-row');
    const inner = screen.queryByTestId('home-service-row-inner');
    if (!row || !inner) return;
    const outOfFlow = (StyleSheet.flatten(inner.props.style) as ViewStyle).position === 'absolute';
    const clip = clipHeight();
    const height = outOfFlow || typeof clip !== 'number' ? NATURAL : Math.max(PADDING, Math.min(NATURAL, clip));
    act(() => fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height } } }));
  };
  layoutPass();
  let visible = true;
  const set = (next: boolean) => {
    visible = next;
    view.rerender(ui(next));
    layoutPass();
  };
  return {
    onHeight,
    clipHeight,
    hide: () => set(false),
    show: () => set(true),
    /** A mapper run followed by a layout pass. */
    frame: () => set(visible),
  };
}

describe('HomeServiceRow measures its natural height outside the clip', () => {
  it('a hide whose shrink is laid out mid-way, then a show, settles at the natural height', () => {
    const row = setup();
    row.frame();
    expect(row.clipHeight()).toBe(NATURAL);

    // Ride goes live: the cards fade, then the clip shrinks; a layout pass lands at 8.6pt.
    row.hide();
    midFrame = 8.6;
    act(() => pending(c => c.to === 0)(true)); // fade done → shrink starts
    row.frame();
    expect(row.clipHeight()).toBe(8.6);
    midFrame = null;
    act(() => pending(c => c.to === 0)(true)); // shrink done → unmounted

    // Ride ends: the row grows back and settles.
    row.show();
    act(() => pending(c => c.to > 1)(true));
    row.frame();
    expect(row.clipHeight()).toBe(NATURAL);
    // The peek never took a squeezed reading for the row's height.
    expect(row.onHeight.mock.calls.map(call => call[0])).toEqual([NATURAL]);
  });

  it('the clip has a height before the first measurement (the content does not size it)', () => {
    render(<HomeServiceRow visible onRide={jest.fn()} onParcel={jest.fn()} onShown={jest.fn()} onHeight={jest.fn()} />);
    const wrap = screen.getByTestId('home-service-row-wrap');
    expect((StyleSheet.flatten(wrap.props.style) as ViewStyle).height).toBe(HOME_SERVICE_ROW_ESTIMATE);
  });
});
