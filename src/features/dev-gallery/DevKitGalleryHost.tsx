import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DevSettings, Modal, Platform, Settings, StatusBar, type StatusBarProps } from 'react-native';
import { ModalRoot } from '../../components/ui/ModalRoot';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { logger } from '../../core/logging/logger';
import { t } from '../../i18n';
import { KitGalleryScreen } from './KitGalleryScreen';

/**
 * iOS launch argument that opens the gallery on start, for scripted screenshots:
 * `xcrun simctl launch <udid> <bundle id> -RHOpenKitGallery YES` (NSUserDefaults argument domain).
 */
export const OPEN_ON_LAUNCH_KEY = 'RHOpenKitGallery';
/** Optional companion argument: `-RHKitGallerySection colors1,type` shows only those sections. */
export const SECTION_ON_LAUNCH_KEY = 'RHKitGallerySection';

const launchSetting = (key: string): unknown => {
  if (Platform.OS !== 'ios') {
    return undefined;
  }
  try {
    return Settings.get(key);
  } catch {
    return undefined;
  }
};

const openOnLaunch = (): boolean => {
  const value = launchSetting(OPEN_ON_LAUNCH_KEY);
  return value === true || value === 1 || value === 'YES' || value === 'true';
};

const sectionOnLaunch = (): string | undefined => {
  const value = launchSetting(SECTION_ON_LAUNCH_KEY);
  return typeof value === 'string' && value ? value : undefined;
};

type Props = React.PropsWithChildren<{
  /** Defaults to `__DEV__`: release builds never register the menu item or mount the gallery. */
  enabled?: boolean;
}>;

/**
 * Dev-only route to the kit gallery (UI-R1). Adds "Open UI kit gallery" to the React Native
 * dev menu and shows the gallery full screen over whatever is mounted (auth, passenger or
 * driver), so it needs no sign-in and touches no navigator. Children render unchanged. On iOS
 * the `-RHOpenKitGallery YES` launch argument opens it on start.
 */
export function DevKitGalleryHost({ enabled = __DEV__, children }: Props) {
  const { theme } = useAppTheme();
  const [open, setOpen] = useState(() => enabled && openOnLaunch());
  const [only] = useState(() => (enabled ? sectionOnLaunch() : undefined));

  useEffect(() => {
    if (!enabled) {
      return;
    }
    try {
      // RN has no API to remove a dev menu item; re-adding the same title replaces it.
      DevSettings.addMenuItem(t('kitGallery.devMenuItem'), () => setOpen(true));
    } catch (error) {
      logger.debug('[kit-gallery] dev menu unavailable', {
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }, [enabled]);

  // A screen that mounts after the gallery opened (e.g. Login's light-content bar) would otherwise
  // win the StatusBar stack, so the gallery pushes its entry once the Modal is on screen.
  const barEntry = useRef<StatusBarProps | null>(null);
  const popBar = useCallback(() => {
    if (barEntry.current) {
      StatusBar.popStackEntry(barEntry.current);
      barEntry.current = null;
    }
  }, []);
  const pushBar = useCallback(() => {
    popBar();
    barEntry.current = StatusBar.pushStackEntry({ barStyle: theme.statusBarStyle, animated: false });
  }, [popBar, theme.statusBarStyle]);
  useEffect(() => {
    if (open && barEntry.current) {
      pushBar(); // theme changed while open
    }
  }, [open, pushBar]);
  useEffect(() => popBar, [popBar]);
  const close = useCallback(() => {
    popBar();
    setOpen(false);
  }, [popBar]);

  return (
    <>
      {children}
      {enabled && open ? (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onShow={pushBar} onRequestClose={close}>
          {/* A Modal is a separate native window: ModalRoot gives it its own StatusBar, safe-area
              provider and gesture root (the gallery's BottomSheet needs the last one). */}
          <ModalRoot>
            <KitGalleryScreen onClose={close} only={only} />
          </ModalRoot>
        </Modal>
      ) : null}
    </>
  );
}
