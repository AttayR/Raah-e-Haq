/**
 * UI-R19 (legacy sweep): the carried review items.
 * - Money never breaks between "Rs" and the number (no-break space from formatMoney).
 * - A sticky footer sits 8 above the keyboard (DESIGN_SYSTEM §5.14), not the home-indicator
 *   inset + 8 (the keyboard covers that inset): kit `stickyFooterBottom` / `useStickyFooterBottom`.
 * - `flushStart` ghost buttons put their label on the 16 gutter.
 */
import React from 'react';
import { Keyboard, Platform, StyleSheet, Text, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { act, render, renderHook, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { BottomSheet, Button, stickyFooterBottom, useStickyFooterBottom } from '../../../src/components/ui';
import { componentTokens } from '../../../src/theme';
import { NBSP, formatMoney, formatSignedMoney } from '../../../src/utils/format';
import { formatMoney as formatWalletMoney } from '../../../src/core/format/money';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
(useColorScheme as jest.MockedFunction<typeof useColorScheme>).mockReturnValue('light');

describe('money keeps "Rs" with its number', () => {
  it('joins the currency and the amount with U+00A0, never a breaking space', () => {
    expect(NBSP).toBe(' ');
    for (const text of [formatMoney(1250), formatMoney(-50), formatSignedMoney(500), formatWalletMoney(58.5), formatMoney(20, 'usd')]) {
      expect(text).toContain(NBSP);
      expect(text).not.toMatch(/ /);
    }
    expect(formatMoney(1250)).toBe('Rs 1,250');
    expect(formatSignedMoney(-50)).toBe('−Rs 50');
  });
});

describe('sticky footer bottom (§5.14)', () => {
  it('is insets.bottom + 8 (at least 16) normally and 8 while the keyboard is up', () => {
    expect(stickyFooterBottom(34, false)).toBe(42);
    expect(stickyFooterBottom(0, false)).toBe(16);
    expect(stickyFooterBottom(34, true)).toBe(8);
    expect(stickyFooterBottom(0, true)).toBe(8);
  });

  it.each(['ios', 'android'] as const)('%s: the hook follows the keyboard and removes its listeners', os => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    const handlers: Record<string, Array<() => void>> = {};
    const remove = jest.fn();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: () => void) => {
      (handlers[event] ??= []).push(handler);
      return { remove };
    }) as unknown as typeof Keyboard.addListener);
    const emit = (event: string) => act(() => (handlers[event] ?? []).forEach(h => h()));
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        {children}
      </SafeAreaProvider>
    );

    const { result, unmount } = renderHook(() => useStickyFooterBottom(), { wrapper });
    expect(result.current).toBe(42);
    emit(os === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow');
    expect(result.current).toBe(8);
    emit(os === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide');
    expect(result.current).toBe(42);
    unmount();
    expect(remove).toHaveBeenCalledTimes(2);

    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
  });
});

describe('BottomSheet footer above the keyboard', () => {
  it.each([
    ['ios', 'keyboardWillShow', 'keyboardWillHide', 336, 508],
    // Android reports the real keyboard (T-592): 312 high, its top at 538 on an 850 window.
    ['android', 'keyboardDidShow', 'keyboardDidHide', 312, 538],
  ] as const)('%s: the footer keeps 8 above the keyboard, then its inset padding again', async (os, showEvent, hideEvent, height, screenY) => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    type KeyboardEvent = { endCoordinates: { height: number; screenY: number } };
    const handlers: Record<string, (e: KeyboardEvent) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: (e: KeyboardEvent) => void) => {
      handlers[event] = handler;
      return { remove: () => undefined };
    }) as unknown as typeof Keyboard.addListener);
    render(
      <ThemeProvider>
        <BottomSheet mode="modal" visible footer={<Button label="Save place" onPress={jest.fn()} />} testID="m">
          <Text>Form</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    await act(async () => {});
    const footerPadding = () => StyleSheet.flatten(screen.getByTestId('m-footer').props.style).paddingBottom;
    // No inset in the test environment: the 16 minimum.
    expect(footerPadding()).toBe(16);
    act(() => handlers[showEvent]({ endCoordinates: { height, screenY } }));
    expect(footerPadding()).toBe(8);
    act(() => handlers[hideEvent]({ endCoordinates: { height: 0, screenY: 850 } }));
    expect(footerPadding()).toBe(16);
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
  });
});

describe('Button flushStart', () => {
  const renderButton = async (props: Partial<React.ComponentProps<typeof Button>>) => {
    render(
      <ThemeProvider>
        <Button label="Choose another trip" variant="ghost" size="sm" fullWidth={false} onPress={jest.fn()} testID="b" {...props} />
      </ThemeProvider>,
    );
    await act(async () => {});
    return StyleSheet.flatten(screen.getByTestId('b').props.style);
  };

  it('shifts a hugging button back by its padding so the label sits on the content edge', async () => {
    const style = await renderButton({ flushStart: true });
    expect(style.marginStart).toBe(-componentTokens.button.paddingHorizontal.sm);
  });

  it('does nothing by default or on a full-width button', async () => {
    expect((await renderButton({})).marginStart).toBeUndefined();
    screen.unmount();
    expect((await renderButton({ flushStart: true, fullWidth: true })).marginStart).toBeUndefined();
  });
});
