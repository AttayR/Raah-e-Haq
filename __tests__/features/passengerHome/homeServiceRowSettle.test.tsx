/**
 * Home service row settle (bug: Ride / Parcel cards stuck clipped to a thin strip after rides
 * went live and ended a few times).
 *
 * Reanimated only sends the keys an animated style returns (`updateProps(view, {})` changes
 * nothing), and a `withTiming` callback that sets the value again runs in the same frame, before
 * the mappers. So a style that drops `height` once settled leaves the native view at whatever
 * height the last mapped frame had. `nativeHeight` below models that: it merges each rendered
 * wrapper style the way the native view receives it.
 *
 * Also covered: a hide whose fade or shrink finishes after a newer show must not take the row
 * out of the peek or unmount it.
 */
import React from 'react';
import * as Reanimated from 'react-native-reanimated';
import { StyleSheet, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { HomeServiceRow } from '../../../src/features/passenger-home/components/HomeServiceRow';

type Done = (finished?: boolean) => void;
type Call = { to: number; done?: Done };

const NATURAL = 96;

let calls: Call[] = [];

function useStableSharedValue<T>(init: T) {
  const ref = React.useRef<{ value: T } | null>(null);
  if (ref.current === null) ref.current = { value: init };
  return ref.current;
}
/** Value returned for the next animated height (the frame the native view last received). */
let frameValue: number | null = null;

beforeEach(() => {
  calls = [];
  frameValue = null;
  // The stock mock makes a new shared value on every render; on device it lives as long as the
  // component, which is what the interleavings below depend on.
  jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(useStableSharedValue as unknown as typeof Reanimated.useSharedValue);
  jest.spyOn(Reanimated, 'withTiming').mockImplementation(((to: number, _config: unknown, done?: Done) => {
    calls.push({ to, done });
    if (done && to > 1 && frameValue !== null) return frameValue;
    return to;
  }) as typeof Reanimated.withTiming);
});

afterEach(() => jest.restoreAllMocks());

/** The pending callbacks of animations that carry one (the height resize and the hide's fade). */
const pending = (pick: (c: Call) => boolean) => {
  const found = calls.filter(c => c.done && pick(c));
  return found[found.length - 1]?.done as Done;
};

function setup(initial: boolean) {
  const onShown = jest.fn();
  let native: ViewStyle = {};
  const sync = () => {
    const wrap = screen.queryByTestId('home-service-row-wrap');
    if (wrap) native = { ...native, ...(StyleSheet.flatten(wrap.props.style) as ViewStyle) };
  };
  let n = 0;
  const ui = (visible: boolean) => {
    n += 1;
    // A fresh onRide each time defeats memo, so the animated style is re-read (the mock reads it
    // on render), which is what a mapper run does on device.
    return <HomeServiceRow visible={visible} onRide={() => n} onParcel={jest.fn()} onShown={onShown} onHeight={jest.fn()} />;
  };
  const view = render(ui(initial));
  const measure = () => {
    const row = screen.queryByTestId('home-service-row');
    if (row) fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height: NATURAL } } });
  };
  measure();
  sync();
  const set = (visible: boolean) => {
    view.rerender(ui(visible));
    sync();
  };
  let currentVisible = initial;
  /** A mapper run: re-read the animated style with the current props. */
  const frame = () => set(currentVisible);
  return {
    onShown,
    measure,
    show: () => {
      currentVisible = true;
      set(true);
      measure();
      sync();
    },
    hide: () => {
      currentVisible = false;
      set(false);
    },
    frame,
    nativeHeight: () => native.height,
    mounted: () => screen.queryByTestId('home-service-row') !== null,
  };
}

describe('HomeServiceRow settles at its natural height', () => {
  it('a show whose last mapped frame was mid-resize (frames dropped) still ends at the natural height', () => {
    const row = setup(true);
    row.hide();
    act(() => pending(c => c.to === 0)(true)); // fade done → shrink starts
    act(() => pending(c => c.to === 0)(true)); // shrink done → unmounted
    expect(row.mounted()).toBe(false);

    frameValue = 12; // the native view last got 12pt, then the app stalled past the duration
    row.show();
    expect(row.nativeHeight()).toBe(12);
    frameValue = null;
    act(() => pending(c => c.to > 1)(true)); // the resize finishes in the stalled frame
    row.frame();
    expect(row.nativeHeight()).toBe(NATURAL);
  });

  it('follows a later change of its natural height once settled', () => {
    const row = setup(true);
    const node = screen.getByTestId('home-service-row');
    act(() => fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 370, height: 120 } } }));
    row.frame();
    expect(row.nativeHeight()).toBe(120);
  });
});

describe('HomeServiceRow ignores a stale hide', () => {
  it('a fade that finishes after a newer show neither leaves the peek nor unmounts the row', () => {
    const row = setup(true);
    row.hide();
    const fadeDone = pending(c => c.to === 0);
    row.show();
    expect(row.onShown).toHaveBeenLastCalledWith(true);
    act(() => fadeDone(true)); // UI ran the fade's end before the show's writes arrived
    expect(row.onShown).toHaveBeenLastCalledWith(true);
    act(() => pending(c => c.to === 0)(true)); // the stale shrink it started ends too
    expect(row.mounted()).toBe(true);
  });

  it('a shrink that finishes after a newer show does not unmount the row', () => {
    const row = setup(true);
    row.hide();
    act(() => pending(c => c.to === 0)(true)); // fade done
    const shrinkDone = pending(c => c.to === 0);
    row.show();
    act(() => shrinkDone(true));
    expect(row.mounted()).toBe(true);
    expect(row.onShown).toHaveBeenLastCalledWith(true);
  });

  it('any order of toggles and callbacks ends shown at natural height, or hidden and unmounted', () => {
    const sequences: Array<Array<'show' | 'hide' | 'flushOne' | 'flushAll'>> = [
      ['hide', 'show', 'flushAll'],
      ['hide', 'flushOne', 'show', 'flushAll'],
      ['hide', 'flushOne', 'flushOne', 'show', 'flushAll'],
      ['hide', 'show', 'hide', 'flushAll'],
      ['hide', 'flushOne', 'show', 'hide', 'show', 'flushAll'],
      ['hide', 'show', 'flushOne', 'hide', 'flushOne', 'show', 'flushAll'],
    ];
    for (const seq of sequences) {
      calls = [];
      const row = setup(true);
      let visible = true;
      const flushed = new Set<Done>();
      const flushOne = () => {
        const next = calls.find(c => c.done && !flushed.has(c.done));
        if (!next?.done) return false;
        flushed.add(next.done);
        act(() => next.done?.(true));
        return true;
      };
      for (const step of seq) {
        if (step === 'show') {
          visible = true;
          row.show();
        } else if (step === 'hide') {
          visible = false;
          row.hide();
        } else if (step === 'flushOne') flushOne();
        else while (flushOne()) {
          /* drain */
        }
      }
      row.frame();
      if (visible) {
        expect({ seq, mounted: row.mounted(), shown: row.onShown.mock.calls.at(-1)?.[0] ?? true }).toEqual({ seq, mounted: true, shown: true });
        expect({ seq, height: row.nativeHeight() }).toEqual({ seq, height: NATURAL });
      } else {
        expect({ seq, mounted: row.mounted(), shown: row.onShown.mock.calls.at(-1)?.[0] }).toEqual({ seq, mounted: false, shown: false });
      }
      screen.unmount();
    }
  });
});
