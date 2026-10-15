/**
 * T-539: the logo blinked for 0.4-0.9 s between the native and the JS splash. iOS used the root
 * view's loadingView, which the new architecture removes as soon as the surface starts (long
 * before JS draws), and Android swapped its splash window background as soon as React mounted
 * its first, still empty view; ThemeProvider then rendered nothing while it read the stored
 * appearance. Now the native splash stays until the JS splash is on screen and asks to hide it,
 * and ThemeProvider shows the splash, not a blank frame, while it reads.
 */
import React from 'react';
import { NativeModules, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import SplashScreen from '../../src/components/SplashScreen';
import { ThemeProvider, useAppTheme } from '../../src/app/providers/ThemeProvider';
import { hideNativeSplash, saveNativeAppearance } from '../../src/core/nativeSplash';

const { readFileSync } = jest.requireActual<{ readFileSync: (file: string, encoding: 'utf8') => string }>('fs');
/** Paths are relative to the repo root (Jest's cwd). */
const read = (p: string) => readFileSync(p, 'utf8');

const native = { hide: jest.fn(), setAppearance: jest.fn() };

beforeEach(() => {
  NativeModules.RHSplash = native;
  native.hide.mockClear();
  native.setAppearance.mockClear();
});

afterEach(() => {
  delete NativeModules.RHSplash;
  jest.restoreAllMocks();
});

describe('native splash hand-over (T-539)', () => {
  it('every JS splash mount hides the native one after its layout and a frame', () => {
    type FrameCallback = (time: number) => void;
    const frames: FrameCallback[] = [];
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameCallback) => {
      frames.push(cb);
      return frames.length;
    });
    render(<SplashScreen />);
    expect(native.hide).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('app-splash'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    expect(native.hide).not.toHaveBeenCalled();
    frames.forEach(cb => cb(0));
    expect(native.hide).toHaveBeenCalledTimes(1);
    screen.unmount();

    // A remount (e.g. Android recreated the Activity while JS lived on: its new window has the
    // logo background again) asks native again; native hide() is idempotent.
    frames.length = 0;
    render(<SplashScreen />);
    fireEvent(screen.getByTestId('app-splash'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } });
    frames.forEach(cb => cb(0));
    expect(native.hide).toHaveBeenCalledTimes(2);
  });

  it('works without the native module (tests, an old build)', () => {
    delete NativeModules.RHSplash;
    expect(() => hideNativeSplash()).not.toThrow();
    expect(() => saveNativeAppearance('dark')).not.toThrow();
  });

  it('ThemeProvider shows its fallback (the splash), not a blank frame, while it reads the appearance', async () => {
    let finish: (value: string | null) => void = () => undefined;
    jest.spyOn(AsyncStorage, 'getItem').mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    render(
      <ThemeProvider fallback={<Text>splash</Text>}>
        <Text>app</Text>
      </ThemeProvider>,
    );
    expect(screen.getByText('splash')).toBeTruthy();
    expect(screen.queryByText('app')).toBeNull();

    await act(async () => {
      finish('dark');
    });
    expect(screen.getByText('app')).toBeTruthy();
    expect(screen.queryByText('splash')).toBeNull();
    // The stored choice is handed to native for the next launch splash.
    expect(native.setAppearance).toHaveBeenCalledWith('dark');
  });

  it('a new appearance choice is handed to native for the next launch splash', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    function Pick() {
      const { setScheme } = useAppTheme();
      return (
        <Text testID="pick" onPress={() => setScheme('light')}>
          pick
        </Text>
      );
    }
    render(
      <ThemeProvider>
        <Pick />
      </ThemeProvider>,
    );
    await act(async () => {});
    expect(native.setAppearance).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('pick'));
    expect(native.setAppearance).toHaveBeenCalledWith('light');
  });

  it('native: iOS keeps the launch screen over the React root until RHSplash.hide (no loadingView)', () => {
    const appDelegate = read('ios/RaaHeHaq/AppDelegate.swift');
    const module = read('ios/RaaHeHaq/RHSplash.m');
    const project = read('ios/RaaHeHaq.xcodeproj/project.pbxproj');
    expect(appDelegate).toMatch(/startReactNative\([\s\S]*?\)\s*NativeSplash\.show\(over: window\)/);
    expect(appDelegate).not.toContain('rootView.loadingView');
    expect(appDelegate).toContain('static let identifier = "RHNativeSplash"');
    expect(module).toContain('RHNativeSplashIdentifier = @"RHNativeSplash"');
    expect(module).toContain('RCT_EXPORT_METHOD(hide)');
    expect(project).toMatch(/RHSplash\.m in Sources \*\/ = \{isa = PBXBuildFile/);
    expect(project.match(/RHSplash\.m in Sources \*\/,/g)).toHaveLength(1);
  });

  it('native: Android swaps the splash window background only when JS asks', () => {
    const activity = read('android/app/src/main/java/com/raahehaq/MainActivity.kt');
    const module = read('android/app/src/main/java/com/raahehaq/RHSplashModule.kt');
    const application = read('android/app/src/main/java/com/raahehaq/MainApplication.kt');
    expect(activity).not.toContain('setBackgroundDrawableResource');
    expect(activity).not.toContain('OnGlobalLayoutListener');
    expect(module).toContain('const val NAME = "RHSplash"');
    expect(module).toMatch(/fun hide\(\)[\s\S]*setBackgroundDrawableResource\(R\.color\.splash_background\)/);
    expect(module).toContain('setApplicationNightMode');
    expect(application).toContain('add(RHSplashPackage())');
  });
});
