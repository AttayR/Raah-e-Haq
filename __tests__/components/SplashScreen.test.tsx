/**
 * T-531 (PERF-02) / UI-R8 (auth-splash): the JS splash continues the native one. navy-950 in
 * both schemes on the iOS SplashBackground colour set and the Android splash_background colour,
 * the 96 white badge with the 64 logo in the exact centre, the wordmark under it, the progress
 * bar only after 800 ms, and small logo assets instead of the 2084 px original. The window behind
 * the app after the splash keeps the theme background (iOS AppBackground, Android window_background).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import SplashScreen, { progressDelayLeft } from '../../src/components/SplashScreen';
import { componentTokens, DarkTheme, LightTheme } from '../../src/theme';

const { readFileSync } = jest.requireActual<{
  readFileSync: { (file: string, encoding: 'utf8'): string; (file: string): Uint8Array };
}>('fs');

/** Paths are relative to the repo root (Jest's cwd). */
const read = (p: string) => readFileSync(p, 'utf8');
const k = componentTokens.splash;

const androidColor = (file: string, name: string): string => {
  const match = new RegExp(`<color name="${name}">(#[0-9A-Fa-f]{6})</color>`).exec(read(file));
  return (match?.[1] ?? '').toUpperCase();
};

type ColorSet = {
  colors: Array<{
    appearances?: Array<{ appearance: string; value: string }>;
    color: { components: { red: string; green: string; blue: string } };
  }>;
};

const iosColor = (set: string, dark: boolean): string => {
  const parsed: ColorSet = JSON.parse(read(`ios/RaaHeHaq/Images.xcassets/${set}.colorset/Contents.json`));
  const entry = parsed.colors.find(c => (c.appearances?.some(a => a.value === 'dark') ?? false) === dark);
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

describe('SplashScreen (T-531, UI-R8)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([false, true])('dark=%s: the native splash is navy-950 and the app window keeps the theme background', dark => {
    const want = k.background.toUpperCase();
    expect(want).toBe('#000D3B');
    expect(iosColor('SplashBackground', dark)).toBe(want);
    const androidFile = dark ? 'android/app/src/main/res/values-night/colors.xml' : 'android/app/src/main/res/values/colors.xml';
    expect(androidColor(androidFile, 'splash_background')).toBe(want);
    const theme = dark ? DarkTheme : LightTheme;
    expect(iosColor('AppBackground', dark)).toBe(theme.colors.background.toUpperCase());
    expect(androidColor(androidFile, 'window_background')).toBe(theme.colors.background.toUpperCase());
  });

  it('native launch screens draw the 96 badge, the 64 logo and (iOS) the wordmark in the same place', () => {
    const storyboard = read('ios/RaaHeHaq/LaunchScreen.storyboard');
    expect(storyboard).toContain('image="SplashBadge"');
    expect(storyboard).toContain('<constraint firstAttribute="width" constant="96"');
    expect(storyboard).toContain('<constraint firstAttribute="width" constant="64"');
    expect(storyboard).toContain('text="Raah-e-Haq"');
    expect(storyboard).toContain('pointSize="22"');
    expect(storyboard).not.toContain('userDefinedRuntimeAttribute');
    expect(storyboard).not.toContain('Powered by React Native');
    const android = read('android/app/src/main/res/drawable/splash_background.xml');
    expect(android).toContain('android:width="96dp"');
    expect(android).toContain('android:width="64dp"');
    expect(read('android/app/src/main/res/drawable/splash_icon.xml')).toContain('android:width="288dp"');
    expect(read('android/app/src/main/java/com/raahehaq/RHSplashModule.kt')).toContain('R.color.window_background');
    expect(read('ios/RaaHeHaq/Info.plist')).toContain('UIStatusBarStyleLightContent');
  });

  it('renders navy with the badge centred, the wordmark out of the flow and no bar at first', () => {
    jest.useFakeTimers();
    render(<SplashScreen />);
    const root = screen.getByTestId('app-splash');
    expect(StyleSheet.flatten(root.props.style)).toMatchObject({
      backgroundColor: k.background,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(root.props.accessibilityLabel).toBe('Raah-e-Haq is loading');
    expect(StyleSheet.flatten(screen.getByTestId('app-splash-badge').props.style)).toMatchObject({
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: k.badgeFill,
    });
    expect(screen.getByTestId('app-splash-wordmark')).toHaveTextContent('Raah-e-Haq');
    if (progressDelayLeft() > 0) {
      expect(screen.queryByTestId('app-splash-progress')).toBeNull();
    }
    act(() => {
      jest.advanceTimersByTime(k.progressDelayMs + 10);
    });
    const bar = screen.getByTestId('app-splash-progress');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({ width: 120, height: 2 });
  });

  it('the progress delay counts from app start, so a later mount does not restart it', () => {
    expect(progressDelayLeft(Date.now() + k.progressDelayMs)).toBe(0);
  });

  it('the logo assets are 120/240/360 px (PERF-02), the native ones 120 dp/pt, the iOS badge 96 pt', () => {
    expect(pngSize('src/assets/images/logo.png')).toEqual([120, 120]);
    expect(pngSize('src/assets/images/logo@2x.png')).toEqual([240, 240]);
    expect(pngSize('src/assets/images/logo@3x.png')).toEqual([360, 360]);
    expect(pngSize('ios/RaaHeHaq/Images.xcassets/SplashLogo.imageset/splash_logo@3x.png')).toEqual([360, 360]);
    expect(pngSize('ios/RaaHeHaq/Images.xcassets/SplashBadge.imageset/splash_badge@3x.png')).toEqual([288, 288]);
    expect(pngSize('android/app/src/main/res/drawable-xxxhdpi/splash_logo.png')).toEqual([480, 480]);
  });
});
