import React from 'react';
import { Image, InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native';
import BrandButton from '../../components/BrandButton';
import { Icon } from '../../components/ui/Icon';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { PHONE_AUTH_COPY as COPY } from '../../features/auth/copy/phoneAuth';
import { styles } from './PhoneAuthScreen.styles';

/**
 * The number pad has no return key on iOS, so each such input gets its own Done bar with its own
 * id, rendered next to it (T-550): on Fabric an InputAccessoryView attaches only to the first
 * input in the window with its id, so one screen-level bar shared by the phone and the code
 * input could show on only one of them. The bar mounts and unmounts with its input.
 */
export const PHONE_INPUT_DONE_ID = 'phoneAuthPhoneDone';
export const CODE_INPUT_DONE_ID = 'phoneAuthCodeDone';
export const REGISTRATION_CODE_DONE_ID = 'registrationCodeDone';

interface KeyboardDoneBarProps {
  /** The input points its `inputAccessoryViewID` at this; one bar per input. */
  nativeID: string;
  testID?: string;
}

/** iOS "Done" bar above the number pad, so the keyboard can always be closed (AUTH-18). */
export function KeyboardDoneBar({ nativeID, testID }: KeyboardDoneBarProps) {
  const { theme } = useAppTheme();
  if (Platform.OS !== 'ios') {
    return null;
  }
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={[styles.doneBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <Pressable
          onPress={Keyboard.dismiss}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.doneButton}
          testID={testID}
        >
          <Text style={[styles.doneText, { color: theme.colors.primaryText }]}>{COPY.keyboard.done}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

interface HeaderProps {
  title: string;
  subtitle: string;
  /** Keyboard up: only the title, so the card and its button fit above the keyboard. */
  compact: boolean;
  /** T-556: the top-start back button (the screen had no way back but a swipe). */
  onBack?: () => void;
}

/** Brand header. Tapping it closes the keyboard (it sits outside the scroll view). */
export function PhoneAuthHeader({ title, subtitle, compact, onBack }: HeaderProps) {
  return (
    <Pressable onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.fixedHeader, compact && styles.fixedHeaderCompact]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={COPY.header.back}
            hitSlop={4}
            style={styles.headerBack}
            testID="phone-auth-back"
          >
            <Icon name="back" size={24} tint={styles.headerBackIcon.color} />
          </Pressable>
        ) : null}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />
        <View style={styles.decorativeCircle4} />
        <View style={styles.decorativeCircle5} />

        <View style={styles.logoContainer}>
          {compact ? null : (
            <View style={styles.logoWrapper}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
          )}
          <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          {compact ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

/** BE-28 otp_ip_limit / otp_verify_limit: phone sign-in is capped, so email is offered. */
export function EmailFallback({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.emailFallback}>
      <Text style={styles.emailFallbackText}>{COPY.emailFallback.hint}</Text>
      <BrandButton
        title={COPY.emailFallback.action}
        onPress={onPress}
        variant="secondary"
        style={styles.emailFallbackButton}
        textStyle={styles.buttonText}
      />
    </View>
  );
}
