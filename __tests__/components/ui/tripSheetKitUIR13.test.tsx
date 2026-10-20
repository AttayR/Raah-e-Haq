/**
 * UI-R13 kit additions for the driver trip sheet (shared-trip-sheet TS2, TS3, TS6.1, PR2 #5):
 * TripTargetRow, the TripSheet `expand` handle, the TripStatusHeader testIDs, MapControls at
 * driving size, and the shared receipt rating block.
 */
import React, { createRef } from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppText, MapControls, TripSheet, TripStatusHeader, TripTargetRow, type TripSheetHandle } from '../../../src/components/ui';
import { ReceiptRatingBlock } from '../../../src/features/rating/components/ReceiptRating';
import type { RatingFormState } from '../../../src/features/rating/components/RatingForm';

describe('TripTargetRow (TS6.1)', () => {
  it('shows the label and the h3 address with the rail glyph of its kind; a tap opens the route', () => {
    const onPress = jest.fn();
    render(<TripTargetRow kind="dropoff" label="Drop-off" address="Emporium Mall, Johar Town" onPress={onPress} accessibilityHint="Shows the full route" />);
    const row = screen.getByTestId('trip-target-row');
    expect(row.props.accessibilityLabel).toBe('Drop-off: Emporium Mall, Johar Town');
    expect(row.props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('trip-target-row-address').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('address-rail-dropoff', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });

  it('one line on compact phones; not a button without a handler', () => {
    render(<TripTargetRow kind="stop" label="Stop 1 of 2" address="Fake stop" numberOfLines={1} />);
    expect(screen.getByTestId('trip-target-row-address').props.numberOfLines).toBe(1);
    expect(screen.getByTestId('trip-target-row').props.accessibilityRole).toBe('text');
  });
});

describe('TripSheet expand handle', () => {
  it('exposes expand() in trip mode and is a no-op on the receipt', () => {
    const ref = createRef<TripSheetHandle>();
    const { rerender } = render(<TripSheet ref={ref} stateKey="to_pickup" header={<AppText>H</AppText>} peek={<AppText>P</AppText>} details={<AppText>D</AppText>} />);
    expect(typeof ref.current?.expand).toBe('function');
    act(() => ref.current?.expand());
    rerender(<TripSheet ref={ref} mode="receipt" stateKey="summary" header={<AppText>H</AppText>} peek={<AppText>R</AppText>} />);
    act(() => ref.current?.expand());
    expect(screen.getByText('R')).toBeTruthy();
  });
});

describe('TripStatusHeader testIDs', () => {
  it('keeps the passenger defaults and takes the driver sheet own', () => {
    const { rerender } = render(<TripStatusHeader title="A" subtitle="B" />);
    expect(screen.getByTestId('active-ride-title')).toBeTruthy();
    rerender(<TripStatusHeader title="A" subtitle="B" titleTestID="driver-ride-title" subtitleTestID="driver-ride-subtitle" />);
    expect(screen.getByTestId('driver-ride-title').props.children).toBe('A');
    expect(screen.getByTestId('driver-ride-subtitle').props.children).toBe('B');
  });
});

describe('MapControls controlSize (TS2)', () => {
  it('draws back and locate at the driving size 56', () => {
    render(<MapControls onBack={jest.fn()} onLocate={jest.fn()} controlSize={56} testID="mc" />);
    [screen.getByTestId('mc-back'), screen.getByTestId('mc-locate')].forEach((button) => {
      const sized = button.findAll((node) => StyleSheet.flatten(node.props.style)?.width === 56);
      expect(sized.length).toBeGreaterThan(0);
    });
  });
});

describe('ReceiptRatingBlock (PR2 #5, DC1 #6)', () => {
  it('shows the stars read-only once rated, nothing without a form or a rating', () => {
    const { rerender } = render(<ReceiptRatingBlock name="Sara" title="How was your ride with Sara?" form={null} myStars={4} ratedLabel="You rated this ride" />);
    expect(screen.getByTestId('receipt-rated').props.accessibilityLabel).toMatch(/4/);
    rerender(<ReceiptRatingBlock name="Sara" title="How was your ride with Sara?" form={null} myStars={null} ratedLabel="You rated this ride" />);
    expect(screen.queryByTestId('receipt-rated')).toBeNull();
    expect(screen.queryByTestId('receipt-rating')).toBeNull();
  });

  it('draws the person, the question and the form while ratable', () => {
    const form: RatingFormState = {
      stars: 0,
      setStars: jest.fn(),
      selected: [],
      toggle: jest.fn(),
      comment: '',
      setComment: jest.fn(),
      config: null,
      status: 'ready',
      reload: jest.fn(),
      submit: jest.fn(),
      submitting: false,
      error: null,
      maxTags: 3,
      maxComment: 500,
      offered: [],
    };
    render(<ReceiptRatingBlock name="Sara" title="How was your ride with Sara?" form={form} myStars={null} ratedLabel="You rated this ride" />);
    expect(screen.getByTestId('receipt-rating')).toBeTruthy();
    expect(screen.getByText('How was your ride with Sara?')).toBeTruthy();
    expect(screen.getByTestId('rate-ride-stars')).toBeTruthy();
  });
});
