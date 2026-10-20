/**
 * UI-R12 kit pieces of the shared trip sheet (shared-trip-sheet.md TS1–TS6, TS8, TS13):
 * the ETA tile and status header, the fare row, the measured peek, the TripSheet modes, the
 * PersonCard busy / sharing / inline states and the `destructiveGhost` Button.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  Button,
  PersonCard,
  TripFareRow,
  TripSheet,
  TripStatusHeader,
  etaTileValue,
  etaA11y,
  tripPeekHeight,
} from '../../../src/components/ui';
import { AppText } from '../../../src/components/ui/AppText';
import { LightTheme } from '../../../src/theme';

describe('ETA tile and status header (TS3)', () => {
  it('shows whole minutes 1…99, "99+" above, and nothing without an ETA', () => {
    expect(etaTileValue(null)).toBeNull();
    expect(etaTileValue(undefined)).toBeNull();
    expect(etaTileValue(Number.NaN)).toBeNull();
    expect(etaTileValue(0.2)).toBe('1');
    expect(etaTileValue(12)).toBe('12');
    expect(etaTileValue(12.1)).toBe('13');
    expect(etaTileValue(150)).toBe('99+');
  });

  it('speaks the ETA as "n minutes away"', () => {
    expect(etaA11y(5)).toBe('5 minutes away');
    expect(etaA11y(1)).toBe('1 minute away');
    expect(etaA11y(null)).toBeNull();
  });

  it('the live region is the title alone, without the ETA; the ETA is read with the subtitle', () => {
    const { rerender } = render(<TripStatusHeader title="Heading to Emporium" subtitle="Arriving at 6:15 PM" etaMinutes={15} />);
    const title = screen.getByTestId('active-ride-title');
    expect(title.props.accessibilityLiveRegion).toBe('polite');
    expect(title.props.accessibilityLabel).toBeUndefined();
    expect(title).toHaveTextContent('Heading to Emporium');
    // No live region on the row (subtitle and ETA ticks are never announced).
    expect(screen.getByTestId('trip-status-header').props.accessibilityLiveRegion).toBeUndefined();
    expect(screen.getByTestId('active-ride-subtitle').props.accessibilityLabel).toBe('15 minutes away. Arriving at 6:15 PM');
    expect(screen.getByTestId('active-ride-subtitle').props.accessibilityLiveRegion).toBeUndefined();
    // Without a subtitle the tile itself carries the spoken ETA.
    rerender(<TripStatusHeader title="Heading to Emporium" etaMinutes={15} />);
    expect(screen.getByTestId('trip-status-header-eta').props.accessibilityLabel).toBe('15 minutes away');
  });

  it('draws the 56 tile only with an ETA; the subtitle takes its tone and badges sit before it', () => {
    const { rerender } = render(
      <TripStatusHeader title="Driver is on the way" subtitle="Meet at Liberty" etaMinutes={7} badges={<AppText testID="badge">AC</AppText>} />,
    );
    // Hidden from screen readers (the title reads it), so the query includes hidden elements.
    expect(screen.getByTestId('trip-status-header-eta-value', { includeHiddenElements: true })).toHaveTextContent('7');
    expect(screen.getByTestId('active-ride-subtitle').props.accessibilityLabel).toBe('7 minutes away. Meet at Liberty');
    expect(screen.getByTestId('badge')).toBeTruthy();
    const tile = StyleSheet.flatten(screen.getByTestId('trip-status-header-eta', { includeHiddenElements: true }).props.style);
    expect(tile).toMatchObject({ width: 56, height: 56, backgroundColor: LightTheme.colors.primarySoft });

    rerender(<TripStatusHeader title="Driver is on the way" subtitle="You're offline." subtitleTone="warning" etaMinutes={null} />);
    expect(screen.queryByTestId('trip-status-header-eta', { includeHiddenElements: true })).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('active-ride-subtitle').props.style).color).toBe(LightTheme.colors.warning);
  });
});

describe('TripFareRow (TS6.2)', () => {
  it('amount, "cash", and the orange Fixed fare tag only when locked', () => {
    const { rerender } = render(<TripFareRow amount={152} fixed accessibilityLabel="locked" />);
    expect(screen.getByTestId('trip-fare-row-amount')).toHaveTextContent('Rs 152');
    expect(screen.getByTestId('trip-fare-row-unit')).toHaveTextContent('cash');
    expect(screen.getByText('Fixed fare')).toBeTruthy();
    expect(screen.getByTestId('trip-fare-row').props.accessibilityLabel).toBe('locked');
    rerender(<TripFareRow amount={152} fixed={false} accessibilityLabel="Rs 152" />);
    expect(screen.queryByTestId('trip-fare-row-tag')).toBeNull();
  });
});

describe('trip sheet peek (TS1)', () => {
  it('is handle 24 + header + peek group + bottom block (footer or max(inset + 8, 16))', () => {
    // iPhone 17: header 56 + 12, peek group 4 + 16 + 128 + 16 + 72 + 12 + 32 = 280, inset 34.
    expect(tripPeekHeight({ header: 68, peek: 280, footer: 0, bottomInset: 34 })).toBe(24 + 68 + 280 + 42);
    // PA1 total on the way with a PIN: 414.
    expect(tripPeekHeight({ header: 68, peek: 280, footer: 0, bottomInset: 34 })).toBe(414);
    // iPhone SE (no home indicator): 16 below.
    expect(tripPeekHeight({ header: 68, peek: 236, footer: 0, bottomInset: 0 })).toBe(344);
    // A sticky footer: 16 + action + bottom.
    expect(tripPeekHeight({ header: 68, peek: 100, footer: 56, bottomInset: 34 })).toBe(24 + 68 + 100 + 16 + 56 + 42);
    // Unmeasured: unknown.
    expect(tripPeekHeight({ header: 0, peek: 100, footer: 0, bottomInset: 34 })).toBeNull();
  });

  it('trip mode has a handle and renders the details under the peek group; receipt mode has no handle', () => {
    const { rerender } = render(
      <TripSheet stateKey="driver_en_route" header={<AppText>Header</AppText>} peek={<AppText>Peek</AppText>} details={<AppText>Details</AppText>} />,
    );
    expect(screen.getByTestId('trip-sheet-handle')).toBeTruthy();
    expect(screen.getByTestId('trip-sheet-details')).toBeTruthy();
    expect(screen.getByText('Peek')).toBeTruthy();
    rerender(
      <TripSheet mode="receipt" stateKey="completed" header={<AppText>Header</AppText>} peek={<AppText>Receipt</AppText>} footer={<AppText>Footer</AppText>} />,
    );
    expect(screen.queryByTestId('trip-sheet-handle')).toBeNull();
    expect(screen.getByTestId('trip-sheet-top')).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
  });
});

describe('PersonCard trip states (TS5)', () => {
  const base = { name: 'Ali', fallbackName: 'Your driver' };

  it('a busy action shows a spinner and takes no taps; a sharing one carries the success dot', () => {
    const onPress = jest.fn();
    const { rerender } = render(
      <PersonCard {...base} actions={[{ key: 'share', icon: 'share', label: 'Share trip', onPress, busy: true, testID: 'share' }]} />,
    );
    expect(screen.getByTestId('share-spinner')).toBeTruthy();
    expect(screen.getByTestId('share').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(screen.getByTestId('share'));
    expect(onPress).not.toHaveBeenCalled();
    rerender(<PersonCard {...base} actions={[{ key: 'share', icon: 'sharing', label: 'Sharing', onPress, dot: true, testID: 'share' }]} />);
    expect(screen.getByTestId('share-dot')).toBeTruthy();
    fireEvent.press(screen.getByTestId('share'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('inline layout puts the actions in the identity row as labelled icon buttons', () => {
    const onPress = jest.fn();
    render(
      <PersonCard
        {...base}
        actionsLayout="inline"
        actions={[
          { key: 'call', icon: 'phone', label: 'Call', onPress, testID: 'call' },
          { key: 'nav', icon: 'navigate', label: 'Navigate', onPress, testID: 'nav' },
        ]}
      />,
    );
    expect(screen.getByLabelText('Call')).toBeTruthy();
    expect(screen.queryByText('Navigate')).toBeNull();
    fireEvent.press(screen.getByTestId('nav'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Button destructiveGhost (TS8)', () => {
  it('is transparent with a danger label and still presses', () => {
    const onPress = jest.fn();
    render(<Button label="Cancel ride" variant="destructiveGhost" leadingIcon="cancelCircle" onPress={onPress} testID="cancel" />);
    expect(StyleSheet.flatten(screen.getByTestId('cancel').props.style).backgroundColor).toBe('transparent');
    expect(StyleSheet.flatten(screen.getByText('Cancel ride').props.style).color).toBe(LightTheme.colors.danger);
    fireEvent.press(screen.getByTestId('cancel'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
