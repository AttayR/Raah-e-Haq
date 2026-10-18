/**
 * T-545 keyboard reveal: the focused kit TextField (with its error) is scrolled above the keyboard
 * and a sticky footer. Pure offset maths, the measure-and-scroll step, the controller's timing
 * (focus with the keyboard up, keyboardDidShow, layout change, first new error) and TextField's
 * reports; plus the kit KeyboardDoneBar and KeyboardAwareScrollView defaults.
 */
import React, { useState } from 'react';
import { Keyboard, Platform, useColorScheme, type KeyboardMetrics } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import {
  KeyboardAwareScrollView,
  KeyboardDoneBar,
  KeyboardRevealContext,
  KeyboardRevealGroup,
  REVEAL_DELAY_MS,
  REVEAL_MARGIN,
  TextField,
  revealInScroll,
  revealOffset,
  useKeyboardRevealController,
  type KeyboardReveal,
  type RevealScrollable,
} from '../../../src/components/ui';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

type Rect = [number, number, number, number];

/** A host view stand-in: fixed window rect and y inside the scroll content. */
const fakeTarget = (windowRect: Rect, contentY: number) => ({
  measureInWindow: jest.fn((cb: (x: number, y: number, w: number, h: number) => void) => cb(...windowRect)),
  measureLayout: jest.fn((_rel: unknown, ok: (x: number, y: number, w: number, h: number) => void) =>
    ok(0, contentY, windowRect[2], windowRect[3]),
  ),
});

const fakeScroll = (windowRect: Rect, inner: unknown = {}) => {
  const scroll = {
    scrollTo: jest.fn(),
    measureInWindow: jest.fn((cb: (x: number, y: number, w: number, h: number) => void) => cb(...windowRect)),
    getInnerViewRef: jest.fn(() => inner),
  };
  return scroll;
};

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

describe('revealOffset', () => {
  const viewport = { top: 100, bottom: 500 };

  it('leaves a visible field alone', () => {
    expect(revealOffset({ offset: 40, field: { top: 200, bottom: 300 }, viewport })).toBeNull();
  });

  it('scrolls a field hidden below (keyboard / sticky footer) just above the edge', () => {
    // bottom 560 must end at 500 − margin.
    expect(revealOffset({ offset: 40, field: { top: 480, bottom: 560 }, viewport })).toBe(40 + 60 + REVEAL_MARGIN);
  });

  it('scrolls a field above the viewport down to its top, never below 0', () => {
    expect(revealOffset({ offset: 200, field: { top: 60, bottom: 120 }, viewport })).toBe(200 - 40 - REVEAL_MARGIN);
    expect(revealOffset({ offset: 10, field: { top: 60, bottom: 120 }, viewport })).toBe(0);
  });

  it('aligns a field taller than the viewport to the top', () => {
    expect(revealOffset({ offset: 0, field: { top: 300, bottom: 900 }, viewport })).toBe(300 - 100 - REVEAL_MARGIN);
  });
});

describe('revealInScroll', () => {
  afterEach(() => jest.restoreAllMocks());

  it('measures the field against the content and the viewport, then scrolls by the hidden part', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    // Viewport 100..500 in the window, scrolled 40 (content top at 60); field 480..560 (y 420 in content).
    const scroll = fakeScroll([0, 100, 390, 400]);
    const target = fakeTarget([16, 480, 358, 80], 420);
    await revealInScroll(scroll, target, 'ios');
    expect(target.measureLayout).toHaveBeenCalledWith(scroll.getInnerViewRef.mock.results[0].value, expect.any(Function), expect.any(Function));
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 40 + 60 + REVEAL_MARGIN, animated: true });
  });

  it('on iOS also keeps clear of the keyboard when nothing shrank the scroll view', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue({ screenX: 0, screenY: 450, width: 390, height: 394 } as KeyboardMetrics);
    const scroll = fakeScroll([0, 100, 390, 744]);
    const target = fakeTarget([16, 400, 358, 80], 300);
    await revealInScroll(scroll, target, 'ios');
    // Content top at 100 → offset 0; field bottom 480 must end at 450 − margin.
    expect(scroll.scrollTo).toHaveBeenCalledWith({ y: 30 + REVEAL_MARGIN, animated: true });
  });

  it('does nothing without the content view or when the field is visible', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const noInner: RevealScrollable = { scrollTo: jest.fn(), measureInWindow: jest.fn() };
    await revealInScroll(noInner, fakeTarget([0, 0, 1, 1], 0), 'ios');
    expect(noInner.scrollTo).not.toHaveBeenCalled();

    const scroll = fakeScroll([0, 100, 390, 400]);
    await revealInScroll(scroll, fakeTarget([16, 200, 358, 80], 140), 'android');
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });
});

describe('useKeyboardRevealController', () => {
  let showListener: (() => void) | null = null;
  let frameListener: (() => void) | null = null;
  let removed = 0;

  beforeEach(() => {
    jest.useFakeTimers();
    showListener = null;
    frameListener = null;
    removed = 0;
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      if (event === 'keyboardDidShow') showListener = cb;
      if (event === 'keyboardDidChangeFrame') frameListener = cb;
      return { remove: () => (removed += 1) };
    }) as unknown as typeof Keyboard.addListener);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const setup = () => {
    const scroll = fakeScroll([0, 100, 390, 400]);
    const hidden = fakeTarget([16, 480, 358, 80], 420);
    const hook = renderHook(() => useKeyboardRevealController(() => scroll));
    return { scroll, hidden, hook };
  };

  const tick = async () => {
    await act(async () => {
      jest.advanceTimersByTime(REVEAL_DELAY_MS);
    });
    await flush();
  };

  it('focus before the keyboard: waits for keyboardDidShow, then reveals; blur stops it', async () => {
    const isVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { scroll, hidden, hook } = setup();
    hook.result.current.focus(hidden);
    await tick();
    expect(scroll.scrollTo).not.toHaveBeenCalled();

    isVisible.mockReturnValue(true);
    act(() => showListener?.());
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);

    hook.result.current.blur(hidden);
    act(() => showListener?.());
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);

    hook.unmount();
    // keyboardDidShow and keyboardDidChangeFrame (T-570) are both removed.
    expect(removed).toBe(2);
  });

  it('T-570: a keyboard frame change while a field is focused reveals it again; none while blurred or hidden', async () => {
    const isVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const { scroll, hidden, hook } = setup();
    hook.result.current.focus(hidden);
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);

    // The keyboard grew (suggestion bar, number pad → text keyboard).
    act(() => frameListener?.());
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);

    // A frame change as the keyboard leaves does nothing.
    isVisible.mockReturnValue(false);
    act(() => frameListener?.());
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);

    isVisible.mockReturnValue(true);
    hook.result.current.blur(hidden);
    act(() => frameListener?.());
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('focus with the keyboard up reveals after the delay; a layout change of the focused field reveals again', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const { scroll, hidden, hook } = setup();
    hook.result.current.focus(hidden);
    expect(scroll.scrollTo).not.toHaveBeenCalled();
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);

    hook.result.current.layoutChanged(hidden);
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);

    // Another field's layout change is ignored.
    hook.result.current.layoutChanged(fakeTarget([16, 900, 358, 80], 840));
    await tick();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('a batch of new errors reveals only the first field, even with the keyboard down', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const { scroll, hook } = setup();
    const first = fakeTarget([16, 520, 358, 80], 460);
    const second = fakeTarget([16, 700, 358, 80], 640);
    hook.result.current.error(first);
    hook.result.current.error(second);
    await tick();
    expect(first.measureInWindow).toHaveBeenCalled();
    expect(second.measureInWindow).not.toHaveBeenCalled();
    expect(scroll.scrollTo).toHaveBeenCalledTimes(1);
  });
});

describe('TextField reports to the reveal controller', () => {
  const fake = (): KeyboardReveal => ({ focus: jest.fn(), blur: jest.fn(), layoutChanged: jest.fn(), error: jest.fn() });

  function Harness({ reveal, error }: { reveal: KeyboardReveal; error?: string }) {
    const [value, setValue] = useState('');
    return (
      <ThemeProvider>
        <KeyboardRevealContext.Provider value={reveal}>
          <TextField label="About you" value={value} onChangeText={setValue} error={error} testID="bio" />
        </KeyboardRevealContext.Provider>
      </ThemeProvider>
    );
  }

  it('focus, layout while focused, blur; a new error once (not on mount)', async () => {
    const reveal = fake();
    const view = render(<Harness reveal={reveal} />);
    await act(async () => {});
    expect(reveal.error).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('bio-input'), 'focus');
    expect(reveal.focus).toHaveBeenCalledTimes(1);
    fireEvent(screen.getByTestId('bio'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } } });
    expect(reveal.layoutChanged).toHaveBeenCalledTimes(1);

    view.rerender(<Harness reveal={reveal} error="Use at most 500 characters." />);
    expect(reveal.error).toHaveBeenCalledTimes(1);
    view.rerender(<Harness reveal={reveal} error="Still too long." />);
    expect(reveal.error).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('bio-input'), 'blur');
    expect(reveal.blur).toHaveBeenCalledTimes(1);
  });

  it('works without a controller (outside a keyboard-aware scroll view)', async () => {
    render(
      <ThemeProvider>
        <TextField label="Name" value="" onChangeText={jest.fn()} error="Enter your name." testID="name" />
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent(screen.getByTestId('name-input'), 'focus');
    expect(screen.getByTestId('name-error')).toHaveTextContent('Enter your name.');
  });
});

describe('T-556: KeyboardRevealGroup keeps a section heading in view with its field', () => {
  const fake = (): KeyboardReveal => ({ focus: jest.fn(), blur: jest.fn(), layoutChanged: jest.fn(), error: jest.fn() });

  function Section({ reveal, error }: { reveal: KeyboardReveal; error?: string }) {
    return (
      <ThemeProvider>
        <KeyboardRevealContext.Provider value={reveal}>
          <KeyboardRevealGroup testID="group">
            <TextField label="Stop A" value="" onChangeText={jest.fn()} testID="a" />
            <TextField label="Stop B" value="" onChangeText={jest.fn()} error={error} testID="b" />
          </KeyboardRevealGroup>
        </KeyboardRevealContext.Provider>
      </ThemeProvider>
    );
  }

  it('fields report the whole group (one target for both), not themselves; errors still reveal the field', async () => {
    const reveal = fake();
    const view = render(<Section reveal={reveal} />);
    await act(async () => {});
    fireEvent(screen.getByTestId('a-input'), 'focus');
    fireEvent(screen.getByTestId('a'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 120 } } });
    fireEvent(screen.getByTestId('a-input'), 'blur');
    fireEvent(screen.getByTestId('b-input'), 'focus');
    const group = (reveal.focus as jest.Mock).mock.calls[0][0];
    expect(group).toBeTruthy();
    // The same target for both fields and every report: the group, so its heading is revealed.
    expect((reveal.focus as jest.Mock).mock.calls[1][0]).toBe(group);
    expect((reveal.layoutChanged as jest.Mock).mock.calls[0][0]).toBe(group);
    expect((reveal.blur as jest.Mock).mock.calls[0][0]).toBe(group);

    view.rerender(<Section reveal={reveal} error="Pick a place." />);
    expect(reveal.error).toHaveBeenCalledTimes(1);
    expect((reveal.error as jest.Mock).mock.calls[0][0]).not.toBe(group);
  });

  it('is a plain view outside a reveal controller', async () => {
    render(
      <ThemeProvider>
        <KeyboardRevealGroup testID="group">
          <TextField label="Stop" value="" onChangeText={jest.fn()} testID="s" />
        </KeyboardRevealGroup>
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent(screen.getByTestId('s-input'), 'focus');
    expect(screen.getByTestId('group')).toContainElement(screen.getByTestId('s'));
  });
});

describe('KeyboardAwareScrollView and KeyboardDoneBar', () => {
  it('scroll view: taps reach buttons with the keyboard up, drag dismisses it, forwards the ref', async () => {
    const ref = React.createRef<React.ComponentRef<typeof KeyboardAwareScrollView>>();
    render(
      <ThemeProvider>
        <KeyboardAwareScrollView ref={ref} testID="form">
          <TextField label="Name" value="" onChangeText={jest.fn()} />
        </KeyboardAwareScrollView>
      </ThemeProvider>,
    );
    await act(async () => {});
    const scroll = screen.getByTestId('form');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe(Platform.OS === 'ios' ? 'interactive' : 'on-drag');
    expect(ref.current).toBeTruthy();
  });

  it('Done bar dismisses the keyboard on iOS and renders nothing on Android', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    render(
      <ThemeProvider>
        <KeyboardDoneBar nativeID="done" label="Done" testID="done" />
      </ThemeProvider>,
    );
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(dismiss).toHaveBeenCalledTimes(1);

    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      render(
        <ThemeProvider>
          <KeyboardDoneBar nativeID="done2" label="Close" testID="done2" />
        </ThemeProvider>,
      );
      await act(async () => {});
      expect(screen.queryByTestId('done2')).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
      dismiss.mockRestore();
    }
  });
});
