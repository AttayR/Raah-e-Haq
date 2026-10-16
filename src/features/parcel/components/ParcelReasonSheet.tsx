import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Radio, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { PARCEL_LIMITS } from '../api';
import type { ParcelChoice } from '../types';

export type ParcelReasonSheetProps = {
  visible: boolean;
  /** `return`: bring the parcel back after pickup; `refuse`: refuse it at the pickup. */
  kind: 'return' | 'refuse';
  /** The server's reasons (GET /parcels/options `return_reasons` / `refusal_reasons`). */
  reasons: ReadonlyArray<ParcelChoice>;
  /** The options could not be read: no reasons to choose from. */
  reasonsError: string | null;
  submitting: boolean;
  onSubmit: (reason: string, note: string) => void;
  onClose: () => void;
};

/** Why the driver returns or refuses a parcel: one of the server's reasons and an optional note. */
export function ParcelReasonSheet({ visible, kind, reasons, reasonsError, submitting, onSubmit, onClose }: ParcelReasonSheetProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setNote('');
    setMissing(false);
  }, [visible, kind]);

  const refuse = kind === 'refuse';
  const submit = () => {
    if (!reason) {
      setMissing(true);
      return;
    }
    onSubmit(reason, note);
  };

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={refuse ? t('parcel.refuseTitle') : t('parcel.returnTitle')}
      testID="parcel-reason-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {refuse ? t('parcel.refuseTitle') : t('parcel.returnTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {refuse ? t('parcel.refuseBody') : t('parcel.returnBody')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={refuse ? t('parcel.confirmRefuse') : t('parcel.confirmReturn')}
            variant={refuse ? 'destructive' : 'primary'}
            size="lg"
            onPress={submit}
            loading={submitting}
            disabled={reasons.length === 0}
            testID="parcel-reason-submit"
          />
          <Button label={t('parcel.cancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="parcel-reason-cancel" />
        </View>
      }
    >
      <View style={styles.body}>
        {reasonsError ? (
          <AppText variant="bodySmall" color="danger" testID="parcel-reason-load-error">
            {reasonsError}
          </AppText>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('parcel.reasonLabel')}>
            {reasons.map((r) => (
              <Radio
                key={r.key}
                label={r.label}
                selected={reason === r.key}
                onSelect={() => {
                  setReason(r.key);
                  setMissing(false);
                }}
                testID={`parcel-reason-${r.key}`}
              />
            ))}
          </View>
        )}
        {missing ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="parcel-reason-missing">
            {t('parcel.reasonRequired')}
          </AppText>
        ) : null}
        <TextField
          label={t('parcel.noteLabel')}
          placeholder={t('parcel.notePlaceholder')}
          value={note}
          onChangeText={setNote}
          maxLength={PARCEL_LIMITS.noteMax}
          multiline
          doneBar
          testID="parcel-reason-note"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[2], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  body: { gap: space[3], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  footer: { gap: space[2] },
});
