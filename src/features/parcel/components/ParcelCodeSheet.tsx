import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, BottomSheet, Button, Icon, OtpInput } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { formatCountdown } from '../../safety/pin';
import { isValidParcelCode } from '../rules';

export type ParcelCodeSheetProps = {
  visible: boolean;
  /** `deliver`: the receiver's SMS code; `returned`: the sender's return code. */
  purpose: 'deliver' | 'returned';
  digits: number;
  submitting: boolean;
  /** The last refusal (wrong code with the tries left), under the boxes. */
  error: string | null;
  /** Seconds until a locked code may be tried again; 0 when not locked. */
  lockedSeconds: number;
  /** Blocked after repeated wrong codes: no entry; the driver returns the parcel or contacts support. */
  blocked: boolean;
  /** Bumped after each refusal so the boxes clear. */
  attempt: number;
  onSubmit: (code: string) => void;
  onClose: () => void;
};

/**
 * The code that finishes a parcel (T-522, BE-88): the receiver's delivery code (SMS), or the
 * sender's return code. The last digit submits; a wrong code says how many tries are left, a
 * lock counts down, a block hides the entry. The code is sent once and never kept.
 */
export function ParcelCodeSheet({ visible, purpose, digits, submitting, error, lockedSeconds, blocked, attempt, onSubmit, onClose }: ParcelCodeSheetProps) {
  const [code, setCode] = useState('');
  const locked = lockedSeconds > 0;
  useEffect(() => {
    setCode('');
  }, [visible, attempt, purpose]);

  const submit = (value: string) => {
    if (!submitting && !locked && !blocked && isValidParcelCode(value, digits)) onSubmit(value);
  };
  const deliver = purpose === 'deliver';

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={deliver ? t('parcel.deliverTitle') : t('parcel.returnedTitle')}
      testID="parcel-code-sheet"
      header={
        <View style={styles.header}>
          <Icon name={blocked ? 'lock' : 'pinCode'} size={32} color={blocked ? 'danger' : 'primaryText'} />
          <AppText variant="h3" align="center" accessibilityRole="header">
            {deliver ? t('parcel.deliverTitle') : t('parcel.returnedTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {blocked ? t('parcel.codeBlocked') : deliver ? t('parcel.deliverBody') : t('parcel.returnedBody')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          {blocked ? null : (
            <Button
              label={t('parcel.confirmCode')}
              size="lg"
              haptic="impactLight"
              onPress={() => submit(code)}
              disabled={locked || !isValidParcelCode(code, digits)}
              loading={submitting}
              testID="parcel-code-submit"
            />
          )}
          <Button label={t('parcel.cancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="parcel-code-cancel" />
        </View>
      }
    >
      {blocked ? null : (
        <View style={styles.body}>
          <OtpInput
            value={code}
            onChange={(next) => {
              if (!submitting) setCode(next);
            }}
            onComplete={submit}
            length={digits}
            label={t('parcel.codeLabel')}
            error={locked ? null : error}
            disabled={locked}
            autoFocus={visible && !locked}
            oneTimeCode={false}
            testID="parcel-code-input"
          />
          {locked ? (
            <Banner tone="warning" icon="lockClock" text={t('parcel.codeLocked', { time: formatCountdown(lockedSeconds) })} testID="parcel-code-locked" />
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[2], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  body: { gap: space[4], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  footer: { gap: space[2] },
});
