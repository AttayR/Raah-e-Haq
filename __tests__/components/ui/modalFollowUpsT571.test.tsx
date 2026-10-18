/**
 * T-571: QA 2026-10-18 modal follow-ups.
 * - The root Dialog fades in JS on a Modal without a native animation, so its (instant) dismiss
 *   lets taps reach the screen as soon as the dialog is gone (bug 1: up to ~1 s lost after
 *   "Keep Ride" behind UIKit's cross-dissolve and the iOS dismiss hold).
 * - A closing kit BottomSheet takes no touches: a scrim tap during the slide-out restarted the
 *   close spring and kept the Modal over the screen longer (bug 2).
 * - A sheet that unmounted before the keyboard hid kept the keyboard height, and its next
 *   presentation came up full height with a blank half (bug 6); the keyboard now goes down when
 *   the close starts (number pad lingering after "Cancel").
 */
import React from 'react';
import { AccessibilityInfo, Keyboard, Modal, Text, useColorScheme } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet } from '../../../src/components/ui';
import { DialogHost } from '../../../src/components/ui/Dialog';
import { modalQueue } from '../../../src/components/ui/modalQueue';
import { confirm, dialog } from '../../../src/core/dialog';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

type Finish = (finished?: boolean) => void;
/**
 * Holds every animation of `kind` until the test finishes them; records the targets. Animations
 * of different values run side by side (a button's press animation must not end the fade).
 */
const hold = (kind: 'withSpring' | 'withTiming') => {
  let running: Finish[] = [];
  const targets: number[] = [];
  jest.spyOn(Reanimated, kind).mockImplementation(((toValue: number, _config: unknown, callback?: Finish) => {
    targets.push(toValue);
    if (callback) running.push(callback);
    return toValue;
  }) as unknown as typeof Reanimated.withSpring);
  return {
    targets,
    finish: () => {
      const done = running;
      running = [];
      act(() => done.forEach((callback) => callback(true)));
    },
  };
};

const modals = () => screen.UNSAFE_queryAllByType(Modal);

/** pointerEvents of the nearest host view above the sheet's scrim that sets it. */
const scrimLayerPointerEvents = (): unknown => {
  let node = screen.getByTestId('sheet-scrim').parent;
  while (node && node.props.pointerEvents === undefined) node = node.parent;
  return node?.props.pointerEvents;
};

/** Clean-ups registered by the running test, run after it even when it fails. */
let cleanups: Array<() => void> = [];
const afterThis = (cleanup: () => void) => cleanups.push(cleanup);

beforeEach(() => {
  modalQueue.reset();
});
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  act(() => dialog.dismissAll());
  jest.restoreAllMocks();
});

describe('T-571 root Dialog fades in JS (bug 1)', () => {
  const Host = ({ sheetUp = false }: { sheetUp?: boolean }) => (
    <ThemeProvider>
      <DialogHost />
      <BottomSheet mode="modal" visible={sheetUp} testID="next-sheet">
        <Text>Next sheet</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  it('fades out on a still presented Modal, then dismisses it without a native animation', async () => {
    const fades = hold('withTiming');
    const view = render(<Host />);
    await act(async () => {});
    act(() => {
      confirm({ title: 'Cancel Ride', confirmLabel: 'Cancel ride', cancelLabel: 'Keep Ride' });
    });
    await act(async () => {});
    fades.finish();
    // Before T-571 the Modal used the native cross-dissolve (taps lost through UIKit's transition).
    expect(modals()[0].props.animationType).toBe('none');
    expect(modals()[0].props.visible).toBe(true);
    expect(fades.targets[fades.targets.length - 1]).toBe(1);

    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-cancel'));
    });
    // Fading out: still presented, takes no taps, and the scrim cannot answer again.
    expect(modals()[0].props.visible).toBe(true);
    expect(fades.targets[fades.targets.length - 1]).toBe(0);
    expect(screen.getByTestId('dialog-fade').props.pointerEvents).toBe('none');

    // A sheet asked for meanwhile waits for the dialog (one root Modal at a time on iOS).
    view.rerender(<Host sheetUp />);
    await act(async () => {});
    expect(screen.queryByText('Next sheet')).toBeNull();

    fades.finish();
    await act(async () => {});
    expect(modals().filter((m) => m.props.animationType === 'none' && m.props.visible === false)).toHaveLength(1);
    expect(screen.queryByText('Next sheet')).toBeNull();

    // The instant dismiss is reported: the turn goes to the sheet.
    act(() => modals()[0].props.onDismiss());
    await act(async () => {});
    expect(screen.getByText('Next sheet')).toBeTruthy();
  });

  it('a confirm() during the fade-out keeps the fading text, then fades in on the same Modal', async () => {
    const fades = hold('withTiming');
    render(<Host />);
    await act(async () => {});
    act(() => {
      confirm({ title: 'Go offline?', confirmLabel: 'Go offline' });
    });
    await act(async () => {});
    fades.finish();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-confirm'));
    });
    act(() => {
      confirm({ title: 'End the trip?', confirmLabel: 'End trip' });
    });
    await act(async () => {});
    expect(screen.getByText('Go offline?')).toBeTruthy();
    expect(screen.queryByText('End the trip?')).toBeNull();

    fades.finish();
    await act(async () => {});
    // No dismiss and present again (nothing for UIKit to refuse): the new question fades in.
    expect(modals().map((m) => m.props.visible)).toEqual([true]);
    expect(screen.getByText('End the trip?')).toBeTruthy();
    expect(screen.queryByText('Go offline?')).toBeNull();
    expect(fades.targets[fades.targets.length - 1]).toBe(1);
    expect(screen.getByTestId('dialog-fade').props.pointerEvents).toBe('auto');
  });
});

describe('T-571 root Dialog review follow-ups', () => {
  const Host = () => (
    <ThemeProvider>
      <DialogHost />
    </ThemeProvider>
  );

  it('Android back during the fade-out does not answer the confirm() queued behind it', async () => {
    const fades = hold('withTiming');
    render(<Host />);
    await act(async () => {});
    act(() => {
      confirm({ title: 'Go offline?', confirmLabel: 'Go offline' });
    });
    await act(async () => {});
    fades.finish();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-confirm'));
    });
    let next: boolean | null = null;
    act(() => {
      confirm({ title: 'End the trip?', confirmLabel: 'End trip' }).then((answer) => {
        next = answer;
      });
    });
    await act(async () => {});
    // Back while the answered dialog fades out: before this fix it cancelled the unseen question.
    await act(async () => {
      modals()[0].props.onRequestClose();
    });
    expect(next).toBeNull();

    fades.finish();
    await act(async () => {});
    expect(screen.getByText('End the trip?')).toBeTruthy();
    // Shown: back answers it as "cancel" as before.
    await act(async () => {
      modals()[0].props.onRequestClose();
    });
    expect(next).toBe(false);
  });

  it('with Reduce Motion on (app setting) the dialog appears and goes without a fade', async () => {
    // RN's Jest setup makes this a jest.fn, which restoreAllMocks does not reset: undo it below.
    const reduceMotion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    afterThis(() => reduceMotion.mockResolvedValue(false));
    // Fades never finish here: the dialog must not wait for one.
    hold('withTiming');
    render(<Host />);
    await act(async () => {});
    act(() => {
      confirm({ title: 'Go offline?', confirmLabel: 'Go offline' });
    });
    await act(async () => {});
    expect(modals()[0].props.visible).toBe(true);
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-confirm'));
    });
    // No timing to wait for: the Modal hides at once.
    expect(modals()[0].props.visible).toBe(false);
  });
});

describe('T-571 kit BottomSheet close (bugs 2, 6 and the lingering number pad)', () => {
  const Sheet = ({ up, footer = false }: { up: boolean; footer?: boolean }) => (
    <ThemeProvider>
      <BottomSheet mode="modal" visible={up} testID="sheet" footer={footer ? <Text>Send</Text> : undefined}>
        <Text>Sheet body</Text>
      </BottomSheet>
    </ThemeProvider>
  );

  it('a scrim tap during the slide-out does not restart the close; the sheet takes no touches', async () => {
    const springs = hold('withSpring');
    const view = render(<Sheet up />);
    await act(async () => {});
    springs.finish();

    expect(scrimLayerPointerEvents()).toBe('auto');

    view.rerender(<Sheet up={false} />);
    await act(async () => {});
    const closes = springs.targets.length;
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    await act(async () => {});
    // Before T-571 the tap restarted the close spring from rest (~0.22 s more of Modal on top).
    expect(springs.targets).toHaveLength(closes);
    expect(scrimLayerPointerEvents()).toBe('none');

    springs.finish();
    await act(async () => {});
    expect(modals()).toHaveLength(0);
  });

  it('dismisses the keyboard when the close starts', async () => {
    const springs = hold('withSpring');
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const view = render(<Sheet up />);
    await act(async () => {});
    springs.finish();
    expect(dismiss).not.toHaveBeenCalled();

    view.rerender(<Sheet up={false} />);
    await act(async () => {});
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('opens again at its own height after it unmounted before the keyboard hid', async () => {
    type Handler = (e: { endCoordinates: { height: number } }) => void;
    const handlers = new Map<string, Set<Handler>>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: Handler) => {
      const set = handlers.get(event) ?? new Set<Handler>();
      set.add(handler);
      handlers.set(event, set);
      return { remove: () => set.delete(handler) };
    }) as unknown as typeof Keyboard.addListener);
    const emit = (event: string, height: number) =>
      act(() => handlers.get(event)?.forEach((handler) => handler({ endCoordinates: { height } })));
    const footerBottom = () => {
      const style = [screen.getByTestId('sheet-footer').props.style].flat(Infinity) as Array<{ bottom?: number } | null>;
      return style.reduce<number | undefined>((bottom, s) => (s && s.bottom !== undefined ? s.bottom : bottom), undefined);
    };
    const springs = hold('withSpring');
    const view = render(<Sheet up footer />);
    await act(async () => {});
    springs.finish();
    emit('keyboardWillShow', 336);
    expect(footerBottom()).toBe(336);

    // Closed while typing; the field leaves with the Modal, so the keyboard hides only after the
    // sheet stopped listening.
    view.rerender(<Sheet up={false} footer />);
    await act(async () => {});
    springs.finish();
    await act(async () => {});
    expect(modals()).toHaveLength(0);
    emit('keyboardWillHide', 0);

    view.rerender(<Sheet up footer />);
    await act(async () => {});
    // Before T-571 the stale 336 lifted the footer and padded the body: a blank half (QA 29).
    expect(footerBottom()).toBe(0);
  });
});
