import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { AppText, Banner, BottomSheet, Button, Icon, OtpInput } from '../../../components/ui';
import { RIDE_PIN_LENGTH } from '../../../config/safety';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { formatCountdown } from '../pin';
import { isValidPin } from '../rules';

export type PinEntrySheetProps = {
  visible: boolean;
  /** POST /rides/{id}/start {pin} is in flight. */
  submitting: boolean;
  /** The last refusal as one line under the digits (wrong PIN, attempts left). */
  error: string | null;
  /** Seconds until a PIN_LOCKED start may be tried again; 0 when not locked. */
  lockedSeconds: number;
  /** PIN_BLOCKED (or the ride's `pin_blocked`): no entry, only "Contact support". */
  blocked: boolean;
  /** Bumped after each refusal so the boxes clear for the next try. */
  attempt: number;
  onSubmit: (pin: string) => void;
  onContactSupport: () => void;
  onClose: () => void;
};

/**
 * The driver's start-trip PIN (T-520, BE-81) on the kit OTP boxes: four digits, the numeric
 * keypad opens at once, and the 4th digit submits (no SMS autofill: this is the passenger's PIN,
 * not a code sent to the driver). A wrong PIN says how many tries are left, a lock counts down
 * and disables the entry (the keypad returns when it runs out), and a block hides the entry and
 * offers "Contact support".
 */
export function PinEntrySheet({
  visible,
  submitting,
  error,
  lockedSeconds,
  blocked,
  attempt,
  onSubmit,
  onContactSupport,
  onClose,
}: PinEntrySheetProps) {
  const [pin, setPin] = useState('');
  const locked = lockedSeconds > 0;
  const inputRef = useRef<TextInput>(null);
  const wasLocked = useRef(locked);

  // The lock ran out while the sheet is open: the keypad comes back for the next try.
  useEffect(() => {
    if (wasLocked.current && !locked && visible && !blocked) inputRef.current?.focus();
    wasLocked.current = locked;
  }, [locked, visible, blocked]);

  // A fresh entry each time the sheet opens and after each refused try.
  useEffect(() => {
    setPin('');
  }, [visible, attempt]);

  const submit = (code: string) => {
    if (!submitting && !locked && isValidPin(code)) onSubmit(code);
  };

  const footer = blocked ? (
    <View style={styles.footer}>
      <Button label={t('safety.contactSupport')} leadingIcon="support" size="lg" onPress={onContactSupport} testID="pin-entry-support" />
      <Button label={t('common.close')} variant="ghost" onPress={onClose} testID="pin-entry-close" />
    </View>
  ) : (
    <View style={styles.footer}>
      <Button
        label={t('safety.pinStart')}
        size="lg"
        haptic="impactLight"
        onPress={() => submit(pin)}
        disabled={locked || !isValidPin(pin)}
        loading={submitting}
        testID="pin-entry-submit"
      />
      <Button label={t('common.cancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="pin-entry-cancel" />
    </View>
  );

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('safety.pinEntryTitle')}
      testID="pin-entry-sheet"
      header={
        <View style={styles.header}>
          <Icon name={blocked ? 'lock' : 'pinCode'} size={32} color={blocked ? 'danger' : 'primaryText'} />
          <AppText variant="h3" align="center" accessibilityRole="header">
            {blocked ? t('safety.pinBlockedTitle') : t('safety.pinEntryTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {blocked ? t('safety.pinBlockedBody') : t('safety.pinEntryBody')}
          </AppText>
        </View>
      }
      footer={footer}
    >
      {blocked ? null : (
        <View style={styles.body}>
          <OtpInput
            ref={inputRef}
            value={pin}
            onChange={setPin}
            onComplete={submit}
            length={RIDE_PIN_LENGTH}
            label={t('safety.pinEntryLabel')}
            error={locked ? null : error}
            disabled={submitting || locked}
            autoFocus={visible && !locked}
            oneTimeCode={false}
            testID="pin-entry-input"
          />
          {locked ? (
            <Banner
              tone="warning"
              icon="lockClock"
              text={t('safety.pinLocked', { time: formatCountdown(lockedSeconds) })}
              testID="pin-entry-locked"
            />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[2], paddingBottom: space[2] },
  body: { gap: space[4], paddingBottom: space[2] },
  footer: { gap: space[2] },
});
