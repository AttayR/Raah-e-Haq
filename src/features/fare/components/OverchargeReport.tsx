import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Card, Icon, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { ASKED_AMOUNT_MAX, REPORT_NOTE_MAX } from '../api';
import { reportStatusText } from '../format';
import { useOverchargeReport } from '../hooks';
import type { OverchargeReportInput, OverchargeReportResult, OverchargeState } from '../types';

/** The typed amount as whole rupees; '' is "no amount", anything else not 1..999999 is invalid. */
export const parseAskedAmount = (text: string): { ok: true; value: number | undefined } | { ok: false } => {
  const cleaned = text.replace(/,/g, '').trim();
  if (cleaned === '') return { ok: true, value: undefined };
  if (!/^\d+$/.test(cleaned)) return { ok: false };
  const value = Number(cleaned);
  return value >= 1 && value <= ASKED_AMOUNT_MAX ? { ok: true, value } : { ok: false };
};

type SheetProps = {
  visible: boolean;
  /** The locked / charged fare to "pay only"; null when unknown. */
  fare: number | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: OverchargeReportInput) => void;
  onClose: () => void;
};

/** The report form: an optional amount the driver asked for and an optional note (BE-82). */
export function OverchargeReportSheet({ visible, fare, submitting, error, onSubmit, onClose }: SheetProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setAmount('');
      setNote('');
      setAmountError(null);
    }
  }, [visible]);

  const submit = () => {
    const parsed = parseAskedAmount(amount);
    if (!parsed.ok) {
      setAmountError(t('fare.reportAmountInvalid'));
      return;
    }
    setAmountError(null);
    onSubmit({ askedAmount: parsed.value, note: note.trim() || undefined });
  };

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('fare.reportTitle')}
      testID="overcharge-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {t('fare.reportTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {fare !== null ? t('fare.reportBody', { fare: formatMoney(fare) }) : t('fare.reportBodyNoFare')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={t('fare.reportSubmit')}
            onPress={submit}
            loading={submitting}
            disabled={submitting}
            haptic="impactLight"
            testID="overcharge-submit"
          />
          <Button label={t('fare.reportCancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="overcharge-cancel" />
        </View>
      }
    >
      <View style={styles.body}>
        <TextField
          label={t('fare.reportAmount')}
          value={amount}
          onChangeText={setAmount}
          placeholder={t('fare.reportAmountPlaceholder')}
          keyboardType="number-pad"
          maxLength={7}
          error={amountError}
          testID="overcharge-amount"
        />
        <TextField
          label={t('fare.reportNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('fare.reportNotePlaceholder')}
          multiline
          maxLength={REPORT_NOTE_MAX}
          testID="overcharge-note"
        />
        {error ? (
          <AppText variant="bodySmall" color="danger" accessibilityLiveRegion="polite" testID="overcharge-error">
            {error}
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

type SectionProps = {
  rideId: number;
  state: OverchargeState | null;
  fare: number | null;
  /** Re-read the ride after a report (or a refusal that says it can no longer be made). */
  onReported?: (result: OverchargeReportResult | null) => void;
  testID?: string;
};

/**
 * Passenger only (BE-82): "Driver asked for more?" while `can_report`, and the latest report's
 * status after (open / upheld with any refund / rejected). Nothing when the server sent neither.
 * After a report (or a refusal saying none can be made) the button goes at once, without waiting
 * for the ride to be read again; the server's state wins as soon as it stops offering the button.
 */
export function OverchargeReportSection({ rideId, state, fare, onReported, testID = 'overcharge' }: SectionProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<{ rideId: number; state: OverchargeState } | null>(null);
  const action = useOverchargeReport(rideId, (result) => {
    setOpen(false);
    setLocal({ rideId, state: { canReport: false, report: result?.report ?? state?.report ?? null } });
    onReported?.(result);
  });
  // The server has caught up (it no longer offers the button): drop the local override, so a
  // later `can_report: true` (a re-matched ride's next driver) shows the button again.
  const serverCanReport = state?.canReport;
  useEffect(() => {
    if (serverCanReport === false) setLocal(null);
  }, [serverCanReport]);
  const shown = local && local.rideId === rideId && serverCanReport !== false ? local.state : state;
  if (!shown || (!shown.canReport && !shown.report)) return null;
  const { report } = shown;
  return (
    <View style={styles.section} testID={testID}>
      {report ? (
        <Card variant="outlined" testID={`${testID}-status`}>
          <View style={styles.statusRow}>
            <Icon name="report" size={20} color="textSecondary" />
            <View style={styles.flex}>
              <AppText variant="label">{t('fare.reportStatusTitle')}</AppText>
              <AppText variant="bodySmall" color="textSecondary" testID={`${testID}-status-text`}>
                {reportStatusText(report)}
              </AppText>
              {report.askedAmount !== null ? (
                <AppText variant="caption" color="textMuted">
                  {t('fare.reportAsked', { amount: formatMoney(report.askedAmount) })}
                </AppText>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}
      {shown.canReport ? (
        <Button
          label={t('fare.reportButton')}
          variant="outline"
          leadingIcon="report"
          onPress={() => setOpen(true)}
          testID={`${testID}-button`}
        />
      ) : null}
      <OverchargeReportSheet
        visible={open}
        fare={fare}
        submitting={action.submitting}
        error={action.error}
        onSubmit={(input) => {
          action.submit(input);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1] },
  body: { gap: space[3] },
  footer: { gap: space[2] },
  section: { gap: space[2] },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
});
