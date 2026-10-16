import React, { useEffect, useRef, useState } from 'react';
import { Platform, Settings, type TextInput } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { PASSENGER_TABS } from '../../../app/navigation/tabs/RoleTabBar';
import { TabBar, TextField, type TabBarItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { GallerySection } from './GallerySection';

/** `-RHKitGalleryFocus dob|address|bio` focuses that field once the scripted steps are done. */
const FOCUS_KEY = 'RHKitGalleryFocus';
/** `-RHKitGalleryTheme dark|light` switches the app theme during the steps (QA B04). */
const THEME_KEY = 'RHKitGalleryTheme';

const launchArg = (key: string): string | undefined => {
  if (Platform.OS !== 'ios') return undefined;
  try {
    const value: unknown = Settings.get(key);
    return typeof value === 'string' && value ? value : undefined;
  } catch {
    return undefined;
  }
};

const TABS: TabBarItem[] = PASSENGER_TABS.map(spec => ({
  key: spec.name,
  label: t(spec.label),
  icon: spec.icon,
  activeIcon: spec.activeIcon,
}));

const STEP_MS = 800;

/**
 * T-548 scripted reproduction (Debug only). Step 1 mounts three fields that all have a Done bar,
 * then unmounts them, so Fabric recycles their native views for step 2: date of birth (Done bar),
 * address (none) and the multiline bio (Done bar), as on Edit profile. Meanwhile the tab bar starts
 * on Account, the theme switches, then Inbox is selected: the pill must follow to Inbox.
 */
export function DoneBarSection() {
  const { setScheme } = useAppTheme();
  const [step, setStep] = useState(1);
  const [active, setActive] = useState('Account');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const dobRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  useEffect(() => {
    const theme = launchArg(THEME_KEY);
    const focus = launchArg(FOCUS_KEY);
    const target = focus === 'dob' ? dobRef : focus === 'address' ? addressRef : focus === 'bio' ? bioRef : null;
    const timers = [
      setTimeout(() => {
        if (theme === 'dark' || theme === 'light') setScheme(theme);
      }, STEP_MS),
      setTimeout(() => {
        setStep(2);
        setActive('Inbox');
      }, STEP_MS * 2),
      setTimeout(() => target?.current?.focus(), STEP_MS * 3),
    ];
    return () => timers.forEach(clearTimeout);
  }, [setScheme]);

  return (
    <GallerySection title="Keyboard Done bar (T-548)">
      {step === 1 ? (
        <>
          <TextField label="1" value="" onChangeText={() => {}} doneBar testID="gallery-done-pre-1" />
          <TextField label="2" value="" onChangeText={() => {}} doneBar testID="gallery-done-pre-2" />
          <TextField label="3" value="" onChangeText={() => {}} multiline doneBar testID="gallery-done-pre-3" />
        </>
      ) : (
        <>
          <TextField
            label={t('profileEdit.dobLabel')}
            value={dob}
            onChangeText={setDob}
            keyboardType="number-pad"
            doneBar
            ref={dobRef}
            testID="gallery-done-dob"
          />
          <TextField
            label={t('profileEdit.addressLabel')}
            value={address}
            onChangeText={setAddress}
            ref={addressRef}
            testID="gallery-done-address"
          />
          <TextField
            label={t('profileEdit.bioLabel')}
            value={bio}
            onChangeText={setBio}
            multiline
            doneBar
            ref={bioRef}
            testID="gallery-done-bio"
          />
        </>
      )}
      <TabBar items={TABS} activeKey={active} onSelect={setActive} testID="gallery-done-tabs" />
    </GallerySection>
  );
}
