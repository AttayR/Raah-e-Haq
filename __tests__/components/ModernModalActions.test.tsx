/**
 * T-567 (QA 2026-10-18 screen 17): ModernModal's action labels ("Verify number") stay on one line
 * in their half-width pills and shrink a little when they must, instead of wrapping.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import ModernModal from '../../src/components/ModernModal';

it('keeps both action labels on one line', async () => {
  render(
    <ModernModal
      config={{
        visible: true,
        type: 'error',
        title: 'Verify your phone number',
        message: 'Please verify your phone number before booking a ride.',
        primaryAction: { label: 'Verify number', onPress: () => undefined },
        secondaryAction: { label: 'Not now', onPress: () => undefined },
      }}
      onClose={() => undefined}
    />,
  );
  await act(async () => {});
  for (const label of ['Verify number', 'Not now']) {
    const text = screen.getByText(label);
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    expect(StyleSheet.flatten(text.props.style).textAlign).toBe('center');
  }
});
