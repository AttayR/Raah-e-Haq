import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Card, Icon, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { AC_NOTE_MAX } from '../api';
import { acReportStatusText } from '../format';
import { useAcReport } from '../hooks';
import type { AcReportResult, AcReportState } from '../types';

type SheetProps = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (note: string | undefined) => void;
  onClose: () => void;
};

/** The "AC not working" form: an optional note (BE-86). */
export function AcReportSheet({ visible, submitting, error, onSubmit, onClose }: SheetProps) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!visible) setNote('');
  }, [visible]);

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('ac.reportTitle')}
      testID="ac-report-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {t('ac.reportTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('ac.reportBody')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={t('ac.reportSubmit')}
            onPress={() => onSubmit(note.trim() || undefined)}
            loading={submitting}
            disabled={submitting}
            haptic="impactLight"
            testID="ac-report-submit"
          />
          <Button label={t('ac.reportCancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="ac-report-cancel" />
        </View>
      }
    >
      <View style={styles.body}>
        <TextField
          label={t('ac.reportNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('ac.reportNotePlaceholder')}
          multiline
          maxLength={AC_NOTE_MAX}
          testID="ac-report-note"
        />
        {error ? (
          <AppText variant="bodySmall" color="danger" accessibilityLiveRegion="polite" testID="ac-report-error">
            {error}
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

type SectionProps = {
  rideId: number;
  /** Ride `ac_report` (passenger, AC rides only); nothing renders without it. */
  state: AcReportState | null;
  /** Re-read the ride after a report (or a refusal saying none can be made). */
  onReported?: (result: AcReportResult | null) => void;
  testID?: string;
};

/**
 * Passenger only, AC rides (BE-86): "AC not working?" while `can_report`, and the latest
 * report's status (under review with the AC part it refunds, refunded, or reviewed) after. The
 * button goes at once after a report; the server's state wins once it stops offering it.
 */
export function AcReportSection({ rideId, state, onReported, testID = 'ac-report' }: SectionProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<{ rideId: number; state: AcReportState } | null>(null);
  const action = useAcReport(rideId, (result) => {
    setOpen(false);
    setLocal({ rideId, state: { canReport: false, report: result?.report ?? state?.report ?? null } });
    onReported?.(result);
  });
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
            <Icon name="ac" size={20} color="textSecondary" />
            <View style={styles.flex}>
              <AppText variant="label">{t('ac.reportStatusTitle')}</AppText>
              <AppText variant="bodySmall" color="textSecondary" testID={`${testID}-status-text`}>
                {acReportStatusText(report)}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}
      {shown.canReport ? (
        <Button
          label={t('ac.reportButton')}
          variant="outline"
          leadingIcon="ac"
          onPress={() => setOpen(true)}
          testID={`${testID}-button`}
        />
      ) : null}
      <AcReportSheet
        visible={open}
        submitting={action.submitting}
        error={action.error}
        onSubmit={(note) => {
          action.submit(note);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1], paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  body: { gap: space[3], paddingHorizontal: layout.gutter },
  footer: { gap: space[2] },
  section: { gap: space[2] },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
});
