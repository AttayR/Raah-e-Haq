import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NotificationManager from '../../src/components/NotificationManager';
import { ThemeProvider } from '../../src/app/providers/ThemeProvider';
import { toast, useToast } from '../../src/core/toast';

const renderHost = (children: React.ReactNode = <Text>screen</Text>) =>
  render(
    <ThemeProvider>
      <NotificationManager>{children}</NotificationManager>
    </ThemeProvider>,
  );

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
  it('renders a toast called from outside React (the old showToast was silent)', () => {
    renderHost();
    expect(screen.queryByTestId('toast')).toBeNull();

    act(() => {
      toast.error('Login failed. Please try again.');
    });

    expect(screen.getByText('Login failed. Please try again.')).toBeTruthy();
  });

  it('announces the toast once for screen readers (no live region, so Android does not read it twice)', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    renderHost();
    act(() => {
      toast.error('No connection', 'Check your internet');
    });
    expect(announce).toHaveBeenCalledWith('No connection. Check your internet');
    expect(screen.getByTestId('toast').props.accessibilityLiveRegion).toBeUndefined();
    announce.mockRestore();
  });

  it('exposes the message and the action as separate accessibility elements', () => {
    renderHost();
    act(() => {
      toast.info('Ride accepted', undefined, { action: { label: 'View', onPress: jest.fn() } });
    });
    expect(screen.getByRole('button', { name: 'Ride accepted' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy();
  });

  it('runs onHide exactly once after a tap dismiss', () => {
    const onHide = jest.fn();
    renderHost();
    act(() => {
      toast.success('Saved', undefined, { onHide });
    });
    fireEvent.press(screen.getByLabelText('Saved'));
    advance(500);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('auto-hides after 3 s and then shows the next queued toast', () => {
    renderHost();
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

  it('dismisses on tap', () => {
    renderHost();
    act(() => {
      toast.warning('Tap me');
    });
    fireEvent.press(screen.getByLabelText('Tap me'));
    advance(500);
    expect(screen.queryByText('Tap me')).toBeNull();
  });

  it('keeps a loading toast until it is hidden by id', () => {
    renderHost();
    let id = '';
    act(() => {
      id = toast.loading('Creating Ride Request');
    });
    advance(10_000);
    expect(screen.getByText('Creating Ride Request')).toBeTruthy();

    act(() => toast.hide(id));
    expect(screen.queryByText('Creating Ride Request')).toBeNull();
  });

  it('runs the action and dismisses', () => {
    const onPress = jest.fn();
    renderHost();
    act(() => {
      toast.info('Ride accepted', undefined, { action: { label: 'View', onPress } });
    });
    fireEvent.press(screen.getByRole('button', { name: 'View' }));
    advance(500);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ride accepted')).toBeNull();
  });

  it('useToast() returns the same API for components', () => {
    function Shows() {
      const t = useToast();
      return <Text onPress={() => t.success('Saved')}>save</Text>;
    }
    renderHost(<Shows />);
    fireEvent.press(screen.getByText('save'));
    expect(screen.getByText('Saved')).toBeTruthy();
  });
});
