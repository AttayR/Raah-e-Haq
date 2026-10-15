import React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import NotificationManager from '../../src/components/NotificationManager';
import { ModalRoot } from '../../src/components/ui/ModalRoot';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { toast, toastStore, useToast } from '../../src/core/toast';

// ThemeProvider holds its children until the stored appearance is read (T-601).
const renderHost = async (children: React.ReactNode = <Text>screen</Text>) => {
  const result = render(
    <ThemeProvider>
      <NotificationManager>{children}</NotificationManager>
    </ThemeProvider>,
  );
  await act(async () => {});
  return result;
};

// Animations finish after their timing; run timers so exit callbacks fire.
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => toast.hide());
  jest.useRealTimers();
});

describe('NotificationManager toast host', () => {
  it('renders a toast called from outside React (the old showToast was silent)', async () => {
    await renderHost();
    expect(screen.queryByTestId('toast')).toBeNull();

    act(() => {
      toast.error('Login failed. Please try again.');
    });

    expect(screen.getByText('Login failed. Please try again.')).toBeTruthy();
  });

  it('announces the toast once for screen readers (no live region, so Android does not read it twice)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderHost();
    act(() => {
      toast.error('No connection', 'Check your internet');
    });
    expect(announce).toHaveBeenCalledWith('No connection. Check your internet');
    expect(screen.getByTestId('toast').props.accessibilityLiveRegion).toBeUndefined();
    announce.mockRestore();
  });

  it('exposes the message and the action as separate accessibility elements', async () => {
    await renderHost();
    act(() => {
      toast.info('Ride accepted', undefined, { action: { label: 'View', onPress: jest.fn() } });
    });
    expect(screen.getByRole('button', { name: 'Ride accepted' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
  });

  it('runs onHide exactly once after a tap dismiss', async () => {
    const onHide = jest.fn();
    await renderHost();
    act(() => {
      toast.success('Saved', undefined, { onHide });
    });
    fireEvent.press(screen.getByLabelText('Saved'));
    advance(500);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('auto-hides after 3 s and then shows the next queued toast', async () => {
    await renderHost();
    act(() => {
      toast.success('First');
      toast.info('Second');
    });
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();

    advance(3000 + 500);

    expect(screen.queryByText('First')).toBeNull();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('dismisses on tap', async () => {
    await renderHost();
    act(() => {
      toast.warning('Tap me');
    });
    fireEvent.press(screen.getByLabelText('Tap me'));
    advance(500);
    expect(screen.queryByText('Tap me')).toBeNull();
  });

  it('keeps a loading toast until it is hidden by id', async () => {
    await renderHost();
    let id = '';
    act(() => {
      id = toast.loading('Creating Ride Request');
    });
    advance(10_000);
    expect(screen.getByText('Creating Ride Request')).toBeTruthy();

    act(() => toast.hide(id));
    expect(screen.queryByText('Creating Ride Request')).toBeNull();
  });

  it('runs the action and dismisses', async () => {
    const onPress = jest.fn();
    await renderHost();
    act(() => {
      toast.info('Ride accepted', undefined, { action: { label: 'View', onPress } });
    });
    fireEvent.press(screen.getByRole('button', { name: 'View' }));
    advance(500);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ride accepted')).toBeNull();
  });

  it('shows both lines in full and joins them with one separator in the announcement (T-411)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await renderHost();
    act(() => {
      toast.error('You are too far from the pickup point.', 'About 960 m away.');
    });
    expect(screen.getByText('About 960 m away.')).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('You are too far from the pickup point. About 960 m away.');
    announce.mockRestore();
  });

  it('moves the toast down by topOffset so it clears a floating back button (T-411)', async () => {
    await renderHost();
    act(() => {
      toast.info('Default');
    });
    const defaultTop = StyleSheet.flatten(screen.getByTestId('toast').props.style).top as number;
    act(() => toast.hide());
    act(() => {
      toast.info('Offset', undefined, { topOffset: 64 });
    });
    expect(StyleSheet.flatten(screen.getByTestId('toast').props.style).top).toBe(defaultTop + 64);
  });

  it('useToast() returns the same API for components', async () => {
    function Shows() {
      const t = useToast();
      return <Text onPress={() => t.success('Saved')}>save</Text>;
    }
    await renderHost(<Shows />);
    fireEvent.press(screen.getByText('save'));
    expect(screen.getByText('Saved')).toBeTruthy();
  });
});

describe('toast inside a native Modal (T-539)', () => {
  // A modal sheet (ModalRoot) is a separate window over the root host: a toast asked for while it
  // is up (a failed share from the SOS sheet) must render inside it, not under it.
  const ModalWindow = ({ open }: { open: boolean }) =>
    open ? (
      <View testID="modal-window">
        <ModalRoot>
          <Text>sheet</Text>
        </ModalRoot>
      </View>
    ) : null;

  it('renders in the open Modal instead of the root, and back at the root once it closes', async () => {
    const { rerender } = await renderHost(<ModalWindow open />);
    act(() => {
      toast.error("Couldn't create a trip link. Please try again.");
    });
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
    expect(within(screen.getByTestId('modal-window')).getByTestId('toast')).toBeTruthy();

    rerender(
      <ThemeProvider>
        <NotificationManager>
          <ModalWindow open={false} />
        </NotificationManager>
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(screen.queryByTestId('modal-window')).toBeNull();
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });

  it('the Modal host outranks the root host; the newest wins at one level', () => {
    const root = toastStore.registerHost(0);
    const modal = toastStore.registerHost(1);
    const rootAgain = toastStore.registerHost(0);
    expect(toastStore.getActiveHost()).toBe(modal.id);
    modal.unregister();
    expect(toastStore.getActiveHost()).toBe(rootAgain.id);
    rootAgain.unregister();
    expect(toastStore.getActiveHost()).toBe(root.id);
    root.unregister();
    expect(toastStore.getActiveHost()).toBeNull();
  });
});
