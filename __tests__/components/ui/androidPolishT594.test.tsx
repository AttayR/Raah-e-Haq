/**
 * T-594 (Android smoke 2026-10-21): kit-level Android polish.
 * - Issue 4: a centred heading (semibold/bold with negative letter spacing) that hugged its width
 *   in a centred column was measured too narrow on Android/Fabric and clipped ("No messages" read
 *   "No"). The state titles take the column's width and centre their text in it; AppText itself
 *   is unchanged, so a centred value in a row keeps its vertical centring.
 * - Issue 6: the Android launcher label is the brand name, "Raah-e-Haq".
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { AppText, EmptyState, ErrorState } from '../../../src/components/ui';

// The app's tsconfig has no Node types, so the Node module is typed here.
const fs = jest.requireActual<{ readFileSync: (file: string, encoding: 'utf8') => string }>('fs');

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', height: 40 } });

const flat = (style: StyleProp<TextStyle>): TextStyle => StyleSheet.flatten(style) ?? {};

const renderThemed = async (ui: React.ReactElement) => {
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

describe('T-594: centred headings cannot clip on Android', () => {
  it('the EmptyState title spans the column and centres its text', async () => {
    await renderThemed(<EmptyState icon="chat" title="No messages" body="Chats with your drivers show here." />);
    const title = flat(screen.getByText('No messages').props.style);
    expect(title.alignSelf).toBe('stretch');
    expect(title.textAlign).toBe('center');
    expect(title.letterSpacing).toBeLessThan(0);
  });

  it('the compact EmptyState and ErrorState titles do too', async () => {
    await renderThemed(
      <>
        <EmptyState size="compact" icon="chat" title="No offers" />
        <ErrorState size="compact" title="Could not load" onRetry={() => undefined} />
      </>,
    );
    expect(flat(screen.getByText('No offers').props.style).alignSelf).toBe('stretch');
    expect(flat(screen.getByText('Could not load').props.style).alignSelf).toBe('stretch');
  });

  it('a centred value in a row is not stretched (it stays vertically centred in the row)', async () => {
    await renderThemed(
      <View style={styles.row}>
        <AppText variant="numericL" align="center">
          Rs 250
        </AppText>
        <AppText variant="h3" align="center">
          Heading
        </AppText>
      </View>,
    );
    expect(flat(screen.getByText('Rs 250').props.style).alignSelf).toBeUndefined();
    expect(flat(screen.getByText('Heading').props.style).alignSelf).toBeUndefined();
  });
});

describe('T-594: Android app label', () => {
  it('is the brand name "Raah-e-Haq"', () => {
    const xml = fs.readFileSync('android/app/src/main/res/values/strings.xml', 'utf8');
    expect(xml).toContain('<string name="app_name">Raah-e-Haq</string>');
  });
});
