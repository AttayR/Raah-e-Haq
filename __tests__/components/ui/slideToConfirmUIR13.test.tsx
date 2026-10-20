/**
 * UI-R13 design review: every "Slide to start/complete trip" crashed with "[Worklets] Tried to
 * synchronously call a non-worklet function slideCompletes on the UI thread". The release check is
 * now a worklet, the gesture builds no animation config on the UI thread, and a new action (Start →
 * Complete trip) gets a fresh slide with the knob home.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { SlideToConfirm, slideCompletes } from '../../../src/components/ui';

type Handlers = { onUpdate: (e: { translationX: number }) => void; onEnd: (e: object, success: boolean) => void };

/**
 * The pan's own callbacks (the workletized functions the UI thread runs). Worklet gestures are not
 * driven by gesture-handler's jest utils (Reanimated's useEvent is a no-op in its mock), so the
 * test calls the real onUpdate / onEnd closures of the rendered gesture.
 */
const panHandlers = (): Handlers => screen.UNSAFE_getByType(GestureDetector).props.gesture.handlers;

const layoutTrack = () =>
  act(() => {
    fireEvent(screen.getByTestId('slide'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 64 } } });
  });

const drag = (translationX: number) => {
  const { onUpdate, onEnd } = panHandlers();
  act(() => {
    onUpdate({ translationX });
    onEnd({}, true);
  });
};

/** Reanimated APIs and the JS callback handed to runOnJS may be captured; anything else must be a worklet. */
const ALLOWED = new Set(['withTiming', 'withSpring', 'runOnJS', 'confirm']);
const nonWorkletsIn = (fn: unknown): string[] => {
  const closure = (fn as { __closure?: Record<string, unknown> }).__closure ?? {};
  return Object.entries(closure)
    .filter(([name, value]) => typeof value === 'function' && !ALLOWED.has(name) && !('__workletHash' in (value as object)))
    .map(([name]) => name);
};

describe('SlideToConfirm (UI-R13 crash fix)', () => {
  it('the release check is a worklet, and the pan callbacks call no plain JS function on the UI thread', () => {
    // The worklets Babel plugin tags workletized functions with a hash.
    expect(slideCompletes).toHaveProperty('__workletHash');
    expect(slideCompletes(201, 236)).toBe(true);
    expect(slideCompletes(150, 236)).toBe(false);
    expect(slideCompletes(10, 0)).toBe(false);
    render(<SlideToConfirm label="Slide to start trip" onConfirm={jest.fn()} testID="slide" />);
    const { onUpdate, onEnd } = panHandlers();
    expect(nonWorkletsIn(onUpdate)).toEqual([]);
    expect(nonWorkletsIn(onEnd)).toEqual([]);
  });

  it('a full drag through the gesture onEnd confirms once; a short one springs back without confirming', () => {
    const onConfirm = jest.fn();
    render(<SlideToConfirm label="Slide to start trip" onConfirm={onConfirm} testID="slide" />);
    // Track 300 wide: travel = 300 − 56 knob − 2 × 4 inset = 236; confirms from 85 % (200.6).
    layoutTrack();
    drag(120);
    expect(onConfirm).not.toHaveBeenCalled();
    drag(260);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
