/** UI-R1: Debug-only kit gallery and its dev-menu host. */
import React from 'react';
import { DevSettings, Modal, StatusBar, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { DevKitGalleryHost } from '../../../src/features/dev-gallery/DevKitGalleryHost';
import { KitGalleryScreen } from '../../../src/features/dev-gallery/KitGalleryScreen';
import { iconGlyphs } from '../../../src/components/ui/icons';
import { lightColors, textStyles } from '../../../src/theme';

const mockSettingsGet = jest.fn((_key: string): unknown => undefined);
jest.mock('react-native/Libraries/Settings/Settings', () => ({
  __esModule: true,
  default: {
    get: (key: string) => mockSettingsGet(key),
    set: jest.fn(),
    watchKeys: jest.fn(() => 0),
    clearWatch: jest.fn(),
  },
}));

const renderThemed = async (ui: React.ReactElement) => {
  render(<ThemeProvider>{ui}</ThemeProvider>);
  await act(async () => {});
};

describe('KitGalleryScreen', () => {
  it('lists every colour token, text style and icon', async () => {
    await renderThemed(<KitGalleryScreen onClose={jest.fn()} />);
    Object.keys(lightColors).forEach(token => expect(screen.getByTestId(`gallery-color-${token}`)).toBeTruthy());
    Object.keys(textStyles).forEach(name => expect(screen.getByTestId(`gallery-type-${name}`)).toBeTruthy());
    Object.keys(iconGlyphs).forEach(name => expect(screen.getByTestId(`gallery-icon-${name}`)).toBeTruthy());
    expect(screen.getByTestId('kit-gallery-mode')).toHaveTextContent('Mode: light');
    expect(screen.queryByText('Below AA')).toBeNull();
  });

  it('shows formatter output', async () => {
    await renderThemed(<KitGalleryScreen onClose={jest.fn()} />);
    expect(screen.getByTestId('gallery-format-formatMoney(1200)')).toHaveTextContent('Rs 1,200');
    expect(screen.getByTestId('gallery-format-formatMoney(null)')).toHaveTextContent('""');
  });

  it('shows the UI-R2 controls: every button variant, fields, OTP, selection, badges, avatars', async () => {
    await renderThemed(<KitGalleryScreen onClose={jest.fn()} />);
    ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'destructiveSoft'].forEach(variant =>
      expect(screen.getByTestId(`gallery-button-${variant}`)).toBeTruthy(),
    );
    ['lg', 'md', 'sm'].forEach(size => expect(screen.getByTestId(`gallery-button-size-${size}`)).toBeTruthy());
    [
      'gallery-field-default',
      'gallery-field-phone',
      'gallery-field-phone-error',
      'gallery-field-password',
      'gallery-field-search',
      'gallery-field-disabled',
      'gallery-field-multiline',
      'gallery-otp',
      'gallery-otp-error',
      'gallery-switch',
      'gallery-checkbox',
      'gallery-radio-cash',
      'gallery-segmented',
      'gallery-badge-count',
      'gallery-avatar-broken',
    ].forEach(id => expect(screen.getByTestId(id)).toBeTruthy());
    expect(screen.getByText('99+')).toBeTruthy();
    ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'destructiveSoft'].forEach(variant =>
      expect(screen.getByTestId(`gallery-button-lg-${variant}`)).toBeTruthy(),
    );
    expect(screen.getByTestId('gallery-button-loading-full').props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.getByLabelText('3 unread')).toBeTruthy();
    ['surfaceAltPressed', 'primarySoftPressed', 'dangerPressed', 'dangerSoftPressed'].forEach(token =>
      expect(screen.getByTestId(`gallery-color-${token}`)).toBeTruthy(),
    );
  });

  it('shows only the requested sections', async () => {
    await renderThemed(<KitGalleryScreen onClose={jest.fn()} only="colors1,format" />);
    expect(screen.getByTestId('gallery-color-background')).toBeTruthy();
    expect(screen.queryByTestId('gallery-color-userLocation')).toBeNull();
    expect(screen.getByTestId('gallery-format-formatMoney(1200)')).toBeTruthy();
    expect(screen.queryByTestId('gallery-type-h1')).toBeNull();
  });

  it('closes from the labelled close button', async () => {
    const onClose = jest.fn();
    await renderThemed(<KitGalleryScreen onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Close the UI kit gallery'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DevKitGalleryHost', () => {
  const addMenuItem = jest.spyOn(DevSettings, 'addMenuItem').mockImplementation(() => {});

  beforeEach(() => addMenuItem.mockClear());

  it('adds a dev-menu item that opens the gallery over the app', async () => {
    await renderThemed(
      <DevKitGalleryHost enabled>
        <Text>app</Text>
      </DevKitGalleryHost>,
    );
    expect(screen.getByText('app')).toBeTruthy();
    expect(screen.queryByTestId('kit-gallery')).toBeNull();
    expect(addMenuItem).toHaveBeenCalledWith('Open UI kit gallery', expect.any(Function));
    await act(async () => {
      addMenuItem.mock.calls[0][1]();
    });
    expect(screen.getByTestId('kit-gallery')).toBeTruthy();
    fireEvent.press(screen.getByTestId('kit-gallery-close'));
    expect(screen.queryByTestId('kit-gallery')).toBeNull();
  });

  it('opens on start with the iOS -RHOpenKitGallery YES launch argument', async () => {
    mockSettingsGet.mockReturnValueOnce('YES');
    await renderThemed(
      <DevKitGalleryHost enabled>
        <Text>app</Text>
      </DevKitGalleryHost>,
    );
    expect(mockSettingsGet).toHaveBeenCalledWith('RHOpenKitGallery');
    expect(screen.getByTestId('kit-gallery')).toBeTruthy();
  });

  it('pushes the themed status bar once shown and pops it on close', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    mockSettingsGet.mockReturnValueOnce('YES');
    await renderThemed(
      <DevKitGalleryHost enabled>
        <Text>app</Text>
      </DevKitGalleryHost>,
    );
    await act(async () => {
      screen.UNSAFE_getByType(Modal).props.onShow();
    });
    expect(push).toHaveBeenCalledWith({ barStyle: 'dark-content', animated: false });
    fireEvent.press(screen.getByTestId('kit-gallery-close'));
    expect(pop).toHaveBeenCalled();
    push.mockRestore();
    pop.mockRestore();
  });

  it('does nothing in a release build', async () => {
    await renderThemed(
      <DevKitGalleryHost enabled={false}>
        <Text>app</Text>
      </DevKitGalleryHost>,
    );
    expect(screen.getByText('app')).toBeTruthy();
    expect(addMenuItem).not.toHaveBeenCalled();
  });
});
