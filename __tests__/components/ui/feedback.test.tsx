/**
 * UI-R3 feedback: Skeleton (shimmer + reduced motion), EmptyState, ErrorState, Banner +
 * OfflineBanner, restyled Toast, Dialog (component, confirm()/alert() store and host).
 */
import React from 'react';
import { AccessibilityInfo, Modal, PixelRatio, StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DarkTheme, LightTheme } from '../../../src/theme';
import { AA_NON_TEXT, AA_TEXT, contrastRatio } from '../../../src/theme/contrast';
import {
  Banner,
  DialogHost,
  DialogSurface,
  LABEL_CHAR_EM,
  labelFitsColumn,
  EmptyState,
  ErrorState,
  OfflineBanner,
  Skeleton,
  SkeletonGroup,
  SkeletonList,
  ToastView,
} from '../../../src/components/ui';
import { alert, confirm, dialog } from '../../../src/core/dialog';
import type { ToastConfig } from '../../../src/core/toast';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
const mockScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockNetInfo = useNetInfo as jest.MockedFunction<typeof useNetInfo>;

const renderThemed = async (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') => {
  mockScheme.mockReturnValue(mode);
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

const flat = (style: StyleProp<ViewStyle & TextStyle>): ViewStyle & TextStyle => StyleSheet.flatten(style) ?? {};
const noop = () => {};
/** Skeleton blocks and the dialog scrim are hidden from screen readers on purpose. */
const HIDDEN = { includeHiddenElements: true } as const;

const layoutWidth = (testID: string, width: number) =>
  act(() => {
    fireEvent(screen.getByTestId(testID, HIDDEN), 'layout', { nativeEvent: { layout: { width, height: 18, x: 0, y: 0 } } });
  });

describe('Skeleton', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is a surfaceAlt block with a text-style height (line height − 6)', async () => {
    await renderThemed(<Skeleton testID="sk" textVariant="body" />);
    expect(flat(screen.getByTestId('sk', HIDDEN).props.style)).toMatchObject({
      height: LightTheme.typography.body.lineHeight - 6,
      backgroundColor: LightTheme.colors.surfaceAlt,
    });
  });

  it('shimmers once measured', async () => {
    await renderThemed(<Skeleton testID="sk" />);
    await layoutWidth('sk', 200);
    expect(screen.getByTestId('sk-shimmer', HIDDEN)).toBeTruthy();
  });

  it('has no shimmer with reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderThemed(<Skeleton testID="sk" />);
    await layoutWidth('sk', 200);
    expect(screen.queryByTestId('sk-shimmer', HIDDEN)).toBeNull();
  });

  it('a group is one busy "Loading" element', async () => {
    await renderThemed(
      <SkeletonGroup testID="grp">
        <Skeleton />
      </SkeletonGroup>,
    );
    const group = screen.getByTestId('grp');
    expect(group.props.accessibilityRole).toBe('progressbar');
    expect(group.props.accessibilityLabel).toBe('Loading');
    expect(group.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('SkeletonList renders the requested rows under an optional hero', async () => {
    await renderThemed(<SkeletonList rows={3} heroHeight={120} testID="list" />, 'dark');
    expect(screen.getByTestId('list')).toBeTruthy();
  });

  it('UI-R15b: the hero never pairs a 100% width with a horizontal margin (it ran past the edge)', async () => {
    await renderThemed(<SkeletonList rows={1} heroHeight={120} testID="list" />);
    const overflowing = screen.UNSAFE_root.findAll((node) => {
      if (typeof node.type !== 'string') return false;
      const style = StyleSheet.flatten(node.props.style) ?? {};
      return style.width === '100%' && (style.marginHorizontal ?? style.marginStart ?? style.marginLeft) !== undefined;
    });
    expect(overflowing).toHaveLength(0);
  });
});

describe('EmptyState and ErrorState', () => {
  it('empty: title as header, body, secondary next action', async () => {
    const onPress = jest.fn();
    await renderThemed(
      <EmptyState icon="rides" title="No rides yet" body="Book your first ride." action={{ label: 'Book a ride', onPress }} testID="e" />,
    );
    expect(screen.getByRole('header', { name: 'No rides yet' })).toBeTruthy();
    expect(screen.getByText('Book your first ride.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('e-action'));
    expect(onPress).toHaveBeenCalled();
  });

  it('error: alert role, retry button, loading while retrying', async () => {
    const onRetry = jest.fn();
    await renderThemed(<ErrorState title="Couldn't load your wallet" body="No connection" onRetry={onRetry} testID="err" />);
    fireEvent.press(screen.getByTestId('err-retry'));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByTestId('err').props.accessibilityRole).toBe('alert');
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('error: retrying blocks presses', async () => {
    const onRetry = jest.fn();
    await renderThemed(<ErrorState title="Couldn't load" onRetry={onRetry} retrying testID="err" />);
    fireEvent.press(screen.getByTestId('err-retry'));
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByTestId('err-retry').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('error: an API message that repeats the title is not shown twice', async () => {
    await renderThemed(<ErrorState title="Couldn't load earnings" body="Couldn't load earnings" onRetry={noop} />);
    expect(screen.getAllByText("Couldn't load earnings")).toHaveLength(1);
  });

  it('error: icon circle in dangerSoft (dark)', async () => {
    await renderThemed(<ErrorState kind="network" title="Offline" onRetry={noop} />, 'dark');
    const circles = screen.UNSAFE_root.findAll(
      node => typeof node.type === 'string' && flat(node.props.style).backgroundColor === DarkTheme.colors.dangerSoft,
    );
    expect(circles.length).toBeGreaterThan(0);
  });
});

describe('Banner', () => {
  it.each([
    ['info', 'infoSoft'],
    ['warning', 'warningSoft'],
    ['danger', 'dangerSoft'],
    ['success', 'successSoft'],
  ] as const)('%s uses %s', async (tone, fill) => {
    await renderThemed(<Banner tone={tone} text="Hello" testID="b" />);
    expect(flat(screen.getByTestId('b').props.style).backgroundColor).toBe(LightTheme.colors[fill]);
  });

  it('text uses the tone colour; the trailing action fires', async () => {
    const onPress = jest.fn();
    await renderThemed(<Banner tone="warning" text="Expiring" action={{ label: 'Update', onPress }} />, 'dark');
    expect(flat(screen.getByText('Expiring').props.style).color).toBe(DarkTheme.colors.warning);
    fireEvent.press(screen.getByRole('button', { name: 'Update' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('offline banner shows only while NetInfo reports offline', async () => {
    mockNetInfo.mockReturnValue({ isConnected: null, isInternetReachable: null } as ReturnType<typeof useNetInfo>);
    await renderThemed(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    mockNetInfo.mockReturnValue({ isConnected: false, isInternetReachable: false } as ReturnType<typeof useNetInfo>);
    await renderThemed(<OfflineBanner />);
    expect(screen.getByText("You're offline. Showing saved info.")).toBeTruthy();
  });
});

describe('Toast (restyle)', () => {
  const config = (over: Partial<ToastConfig> = {}): ToastConfig => ({
    id: 't1',
    type: 'success',
    title: 'Ride booked',
    duration: 0,
    ...over,
  });

  it.each([
    ['light', LightTheme.colors.textPrimary],
    ['dark', DarkTheme.colors.surfaceRaised],
  ] as const)('inverse fill in %s mode', async (mode, fill) => {
    await renderThemed(<ToastView config={config()} onHide={noop} />, mode);
    expect(flat(screen.getByTestId('toast').props.style).backgroundColor).toBe(fill);
  });

  it.each([
    ['light', LightTheme.colors.textPrimary, LightTheme.colors.textInverse],
    ['dark', DarkTheme.colors.surfaceRaised, DarkTheme.colors.textPrimary],
  ] as const)(
    '[T-514] the driver "Trip complete." success toast passes AA on its opaque fill (%s)',
    async (mode, fill, text) => {
      await renderThemed(<ToastView config={config({ title: 'Trip complete.' })} onHide={noop} />, mode);
      const toastStyle = flat(screen.getByTestId('toast').props.style);
      expect(toastStyle.backgroundColor).toBe(fill);
      expect(flat(screen.getByText('Trip complete.').props.style).color).toBe(text);
      expect(contrastRatio(text, fill)).toBeGreaterThanOrEqual(AA_TEXT);
      // The success glyph uses the inverse (dark-mode) success token, readable on the fill.
      expect(contrastRatio(DarkTheme.colors.success, fill)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    },
  );

  it('the action runs and the toast hides', async () => {
    jest.useFakeTimers();
    const onPress = jest.fn();
    const onHide = jest.fn();
    await renderThemed(<ToastView config={config({ action: { label: 'Undo', onPress } })} onHide={onHide} />);
    fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(onPress).toHaveBeenCalled();
    expect(onHide).toHaveBeenCalledWith('t1');
    jest.useRealTimers();
  });

  it('[UI-R3] title and message are each capped at 2 lines', async () => {
    await renderThemed(<ToastView config={config({ message: 'A longer explanation' })} onHide={noop} />);
    expect(screen.getByText('Ride booked').props.numberOfLines).toBe(2);
    expect(screen.getByText('A longer explanation').props.numberOfLines).toBe(2);
  });

  it('preview is static (gallery) and never hides itself', async () => {
    jest.useFakeTimers();
    const onHide = jest.fn();
    await renderThemed(<ToastView preview config={config({ duration: 1000 })} onHide={onHide} />);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('toast-preview-success')).toBeTruthy();
    expect(onHide).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('Dialog', () => {
  afterEach(() => act(() => dialog.dismissAll()));

  it('surface: title, body and side-by-side short actions', async () => {
    const yes = jest.fn();
    await renderThemed(
      <DialogSurface
        title="Sign out?"
        body="You will need your number."
        actions={[
          { label: 'Sign out', onPress: yes, variant: 'destructive' },
          { label: 'Cancel', onPress: noop, variant: 'ghost' },
        ]}
        testID="d"
      />,
      'dark',
    );
    expect(screen.getByRole('header', { name: 'Sign out?' })).toBeTruthy();
    expect(flat(screen.getByTestId('d').props.style).backgroundColor).toBe(DarkTheme.colors.surfaceRaised);
    fireEvent.press(screen.getByText('Sign out'));
    expect(yes).toHaveBeenCalled();
  });

  it('[UI-R3] stacks the two buttons (primary on top) above 1.3x font scale', async () => {
    const actions = [
      { label: 'Sign out', onPress: noop, variant: 'destructive' as const },
      { label: 'Cancel', onPress: noop, variant: 'ghost' as const },
    ];
    const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    await renderThemed(<DialogSurface title="Sign out?" actions={actions} testID="d1" />);
    expect(flat(screen.getByTestId('d1-actions').props.style).flexDirection).toBe('row');
    // Side by side: cancel at the start, primary at the end.
    expect(screen.getByTestId('d1-action-0')).toHaveTextContent('Cancel');
    screen.unmount();

    scale.mockReturnValue(1.5);
    await renderThemed(<DialogSurface title="Sign out?" actions={actions} testID="d2" />);
    expect(flat(screen.getByTestId('d2-actions').props.style).flexDirection).toBeUndefined();
    expect(screen.getByTestId('d2-action-0')).toHaveTextContent('Sign out');
    jest.restoreAllMocks();
  });

  it('[UI-R18 review] a label never truncates: "Delete account" + "Cancel" stack; layout stacked always stacks', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    const long = [
      { label: 'Delete account', onPress: noop, variant: 'destructive' as const },
      { label: 'Cancel', onPress: noop, variant: 'ghost' as const },
    ];
    await renderThemed(<DialogSurface title="Delete your account?" actions={long} testID="d3" />);
    expect(flat(screen.getByTestId('d3-actions').props.style).flexDirection).toBeUndefined();
    expect(screen.getByTestId('d3-action-0')).toHaveTextContent('Delete account');
    screen.unmount();

    const short = [
      { label: 'Sign out', onPress: noop, variant: 'destructive' as const },
      { label: 'Cancel', onPress: noop, variant: 'ghost' as const },
    ];
    await renderThemed(<DialogSurface title="Sign out?" actions={short} layout="stacked" testID="d4" />);
    expect(flat(screen.getByTestId('d4-actions').props.style).flexDirection).toBeUndefined();
    expect(screen.getByTestId('d4-action-0')).toHaveTextContent('Sign out');
    jest.restoreAllMocks();
  });

  it('[UI-R18 review] labelFitsColumn errs towards stacking and grows with the font scale', () => {
    expect(labelFitsColumn('Cancel', 340, 1)).toBe(true);
    expect(labelFitsColumn('Sign out', 340, 1)).toBe(true);
    expect(labelFitsColumn('Delete account', 340, 1)).toBe(false);
    // [UI-R18 review r2] 0.56 em: these pairs go side by side (iPhone 17 surface 340, SE 327).
    expect(LABEL_CHAR_EM).toBe(0.56);
    expect(labelFitsColumn('Cancel ride', 340, 1) && labelFitsColumn('Keep ride', 340, 1)).toBe(true);
    expect(labelFitsColumn('Send alert', 327, 1) && labelFitsColumn('Cancel', 327, 1)).toBe(true);
    expect(labelFitsColumn('Open settings', 327, 1)).toBe(false);
    expect(labelFitsColumn('Keep editing', 327, 1)).toBe(false);
    expect(labelFitsColumn('Sign out', 280, 1.3)).toBe(false);
  });

  it('[UI-R18 review r2] "Cancel ride" / "Keep ride" sit side by side', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    const actions = [
      { label: 'Cancel ride', onPress: noop, variant: 'destructive' as const },
      { label: 'Keep ride', onPress: noop, variant: 'ghost' as const },
    ];
    await renderThemed(<DialogSurface title="Cancel ride?" actions={actions} testID="d5" />);
    expect(flat(screen.getByTestId('d5-actions').props.style).flexDirection).toBe('row');
    jest.restoreAllMocks();
  });

  it('[UI-R18 review] confirm({ layout: "stacked" }) reaches the host', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    await renderThemed(<DialogHost />);
    act(() => {
      confirm({ title: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No', layout: 'stacked' }).catch(noop);
    });
    expect(flat(screen.getByTestId('dialog-actions').props.style).flexDirection).toBeUndefined();
    act(() => {
      dialog.dismissAll();
    });
    jest.restoreAllMocks();
  });

  it('confirm() resolves true on confirm, with a destructive button', async () => {
    await renderThemed(<DialogHost />);
    let answer: boolean | undefined;
    act(() => {
      confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true }).then(v => {
        answer = v;
      });
    });
    expect(screen.getByText('Sign out?')).toBeTruthy();
    const confirmButton = screen.getByTestId('dialog-confirm');
    expect(flat(confirmButton.props.style).backgroundColor).toBe(LightTheme.colors.dangerFill);
    await act(async () => {
      fireEvent.press(confirmButton);
    });
    expect(answer).toBe(true);
    expect(screen.queryByText('Sign out?')).toBeNull();
  });

  it('cancel and the scrim answer false; dialogs queue one at a time', async () => {
    await renderThemed(<DialogHost />);
    const answers: boolean[] = [];
    act(() => {
      confirm({ title: 'First?', confirmLabel: 'Yes' }).then(v => answers.push(v));
      confirm({ title: 'Second?', confirmLabel: 'Yes' }).then(v => answers.push(v));
    });
    expect(screen.queryByText('Second?')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-cancel'));
    });
    expect(screen.getByText('Second?')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dialog-scrim', HIDDEN));
    });
    expect(answers).toEqual([false, false]);
  });

  it('only the newest host renders (a host inside a native Modal wins, iOS)', async () => {
    const Hosts = ({ inner }: { inner: boolean }) => (
      <>
        <DialogHost />
        {inner ? <DialogHost /> : null}
      </>
    );
    mockScheme.mockReturnValue('light');
    const view = render(
      <ThemeProvider>
        <Hosts inner />
      </ThemeProvider>,
    );
    await act(async () => {});
    act(() => {
      confirm({ title: 'Nested?', confirmLabel: 'Yes' });
    });
    expect(screen.getAllByText('Nested?')).toHaveLength(1);
    view.rerender(
      <ThemeProvider>
        <Hosts inner={false} />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.getAllByText('Nested?')).toHaveLength(1);
  });

  it('a host inside a Modal (inline) outranks the root host even when it mounted first', async () => {
    // Child effects run before the root's, so the Modal's host can register first.
    await renderThemed(
      <>
        <DialogHost inline />
        <DialogHost />
      </>,
    );
    act(() => {
      confirm({ title: 'Inside?', confirmLabel: 'Yes' });
    });
    expect(screen.getAllByText('Inside?')).toHaveLength(1);
    expect(screen.UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  });

  it('alert() has one Done button and resolves on it', async () => {
    await renderThemed(<DialogHost />);
    let done = false;
    act(() => {
      alert({ title: 'Report sent' }).then(() => {
        done = true;
      });
    });
    expect(screen.queryByTestId('dialog-cancel')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText('Done'));
    });
    expect(done).toBe(true);
  });
});
