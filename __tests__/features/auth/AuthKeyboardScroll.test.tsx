/** T-204 (AUTH-13): the auth scroll body keeps the focused input above the keyboard. */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import {
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  type KeyboardEventListener,
} from 'react-native';
import AuthKeyboardScroll, { KEYBOARD_REVEAL_MARGIN } from '../../../src/features/auth/components/AuthKeyboardScroll';
import { revealOffset } from '../../../src/features/auth/keyboardReveal';

type FocusedInput = ReturnType<typeof TextInput.State.currentlyFocusedInput>;
type MeasureCallback = (x: number, y: number, width: number, height: number) => void;

const focusedAt = (y: number, height: number) =>
  ({ measureInWindow: (cb: MeasureCallback) => cb(0, y, 300, height) } as unknown as FocusedInput);

describe('revealOffset', () => {
  it('scrolls by the overlap plus the margin when the input is under the keyboard', () => {
    expect(revealOffset({ fieldBottom: 600, keyboardTop: 500, scrollY: 40, margin: 20 })).toBe(160);
  });

  it('does nothing when the input already clears the keyboard', () => {
    expect(revealOffset({ fieldBottom: 400, keyboardTop: 500, scrollY: 40, margin: 20 })).toBeNull();
    expect(revealOffset({ fieldBottom: 480, keyboardTop: 500, scrollY: 0, margin: 20 })).toBeNull();
  });
});

describe('AuthKeyboardScroll', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const keyboardEvent = (screenY: number) =>
    ({ endCoordinates: { screenX: 0, screenY, width: 375, height: 300 } } as Parameters<KeyboardEventListener>[0]);

  const captureKeyboardListeners = () => {
    const handlers: Record<string, KeyboardEventListener> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      handlers[event] = handler;
      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
    return { handlers, remove };
  };

  it('lets the first tap through and avoids the keyboard with a single scroller', () => {
    render(
      <AuthKeyboardScroll>
        <Text>body</Text>
      </AuthKeyboardScroll>,
    );
    const scrolls = screen.UNSAFE_getAllByType(ScrollView);
    expect(scrolls).toHaveLength(1);
    expect(scrolls[0].props.keyboardShouldPersistTaps).toBe('handled');
    // Jest runs as iOS: the avoiding view pads by the keyboard height.
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
  });

  it('scrolls the focused input above the keyboard when it opens, and removes the listener', () => {
    const { handlers, remove } = captureKeyboardListeners();
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focusedAt(560, 48));

    const { unmount } = render(
      <AuthKeyboardScroll>
        <Text>body</Text>
      </AuthKeyboardScroll>,
    );
    act(() => handlers.keyboardDidShow(keyboardEvent(500)));
    expect(scrollTo).toHaveBeenCalledWith({ y: 560 + 48 + KEYBOARD_REVEAL_MARGIN - 500, animated: true });

    unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('does not scroll when the focused input is already visible or nothing is focused', () => {
    const { handlers } = captureKeyboardListeners();
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    const focusedSpy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(focusedAt(100, 48));

    render(
      <AuthKeyboardScroll>
        <Text>body</Text>
      </AuthKeyboardScroll>,
    );
    act(() => handlers.keyboardDidShow(keyboardEvent(500)));
    focusedSpy.mockReturnValue(null as unknown as FocusedInput);
    act(() => handlers.keyboardDidShow(keyboardEvent(500)));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
