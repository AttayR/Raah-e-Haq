/**
 * T-531 (PERF-02): the JS splash continues the native one. Same background colour in both
 * schemes as the iOS SplashBackground colour set and the Android splash_background colour, the
 * logo at 120 pt in the exact centre, and small logo assets instead of the 2084 px original.
 */
import React from 'react';
import { Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import * as ReactNative from 'react-native';
import { render, screen } from '@testing-library/react-native';
import SplashScreen from '../../src/components/SplashScreen';
import { DarkTheme, LightTheme } from '../../src/theme';

const { readFileSync } = jest.requireActual<{
  readFileSync: { (file: string, encoding: 'utf8'): string; (file: string): Uint8Array };
}>('fs');

/** Paths are relative to the repo root (Jest's cwd). */
const read = (p: string) => readFileSync(p, 'utf8');

const androidColor = (file: string): string => {
  const match = /<color name="splash_background">(#[0-9A-Fa-f]{6})<\/color>/.exec(read(file));
  return (match?.[1] ?? '').toUpperCase();
};

type ColorSet = {
  colors: Array<{
    appearances?: Array<{ appearance: string; value: string }>;
    color: { components: { red: string; green: string; blue: string } };
  }>;
};

const iosColor = (dark: boolean): string => {
  const set: ColorSet = JSON.parse(read('ios/RaaHeHaq/Images.xcassets/SplashBackground.colorset/Contents.json'));
  const entry = set.colors.find(c => (c.appearances?.some(a => a.value === 'dark') ?? false) === dark);
  const hex = (v: string | undefined) => (v ?? '').replace(/^0x/i, '').toUpperCase().padStart(2, '0');
  const { red, green, blue } = entry?.color.components ?? { red: '', green: '', blue: '' };
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
};

/** Width/height of a PNG from its IHDR chunk (a JPEG renamed .png fails the signature). */
const pngSize = (p: string): [number, number] => {
  const bytes = readFileSync(p);
  expect(String.fromCharCode(bytes[1], bytes[2], bytes[3])).toBe('PNG');
  const u32 = (at: number) => ((bytes[at] * 256 + bytes[at + 1]) * 256 + bytes[at + 2]) * 256 + bytes[at + 3];
  return [u32(16), u32(20)];
};

describe('SplashScreen (T-531)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: the native splash colours match the theme background', (scheme, theme) => {
    const want = theme.colors.background.toUpperCase();
    expect(iosColor(scheme === 'dark')).toBe(want);
    expect(androidColor(scheme === 'dark' ? 'android/app/src/main/res/values-night/colors.xml' : 'android/app/src/main/res/values/colors.xml')).toBe(want);
  });

  it.each([
    ['light', LightTheme],
    ['dark', DarkTheme],
  ] as const)('%s: renders on the theme background with the logo centred at 120 pt', (scheme, theme) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(scheme);
    render(<SplashScreen />);

    const root = screen.getByTestId('app-splash');
    expect(StyleSheet.flatten(root.props.style)).toMatchObject({
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    });
    const logo = screen.UNSAFE_getByType(Image);
    expect(StyleSheet.flatten(logo.props.style)).toMatchObject({ width: 120, height: 120 });
    // The spinner is taken out of the flow, so the logo is not pushed up off centre.
    const children = React.Children.toArray(root.props.children) as React.ReactElement<{ style?: StyleProp<ViewStyle> }>[];
    const spinnerSlot = children.find(c => c.type !== Image);
    expect(StyleSheet.flatten(spinnerSlot?.props.style)).toMatchObject({ position: 'absolute' });
  });

  it('the logo assets are 120/240/360 px (PERF-02), the native ones 120 dp/pt', () => {
    expect(pngSize('src/assets/images/logo.png')).toEqual([120, 120]);
    expect(pngSize('src/assets/images/logo@2x.png')).toEqual([240, 240]);
    expect(pngSize('src/assets/images/logo@3x.png')).toEqual([360, 360]);
    expect(pngSize('ios/RaaHeHaq/Images.xcassets/SplashLogo.imageset/splash_logo@3x.png')).toEqual([360, 360]);
    expect(pngSize('android/app/src/main/res/drawable-xxxhdpi/splash_logo.png')).toEqual([480, 480]);
    expect(read('ios/RaaHeHaq/LaunchScreen.storyboard')).not.toContain('Powered by React Native');
  });
});
