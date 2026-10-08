/** T-113: PhoneAuth compacts its header while the keyboard is up; listeners are removed on unmount. */
import { act, renderHook } from '@testing-library/react-native';
import { Keyboard, type KeyboardEventListener } from 'react-native';
import { useKeyboardVisible } from '../../src/hooks/useKeyboardVisible';

describe('useKeyboardVisible', () => {
  afterEach(() => jest.restoreAllMocks());

  it('follows show/hide events and removes both listeners on unmount', () => {
    const handlers: Record<string, KeyboardEventListener> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      handlers[event] = handler;
      return { remove } as unknown as ReturnType<typeof Keyboard.addListener>;
    });

    const { result, unmount } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);

    const event = {} as Parameters<KeyboardEventListener>[0];
    act(() => handlers.keyboardWillShow(event));
    expect(result.current).toBe(true);
    act(() => handlers.keyboardWillHide(event));
    expect(result.current).toBe(false);

    unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
