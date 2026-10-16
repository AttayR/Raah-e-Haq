import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Card, Icon, TextField } from '../../../components/ui';
import { t, type TranslationKey } from '../../../i18n';
import { layout, space } from '../../../theme';
import { SAFETY_NOTE_MAX, SAFETY_NOTE_MIN } from '../api';
import { useSafetyReport } from '../hooks';
import type { SafetyReportState, SafetyReportStatus } from '../types';

type SheetProps = {
  visible: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onClose: () => void;
};

/** The report form: what happened (required, at least 3 characters). */
export function SafetyReportSheet({ visible, submitting, error, onSubmit, onClose }: SheetProps) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) {
      setNote('');
      setNoteError(null);
    }
  }, [visible]);

  const submit = () => {
    if (note.trim().length < SAFETY_NOTE_MIN) {
      setNoteError(t('womenMode.reportNoteRequired'));
      return;
    }
    setNoteError(null);
    onSubmit(note.trim());
  };

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('womenMode.reportTitle')}
      testID="safety-report-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {t('womenMode.reportTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('womenMode.reportBody')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={t('womenMode.reportSubmit')}
            variant="destructive"
            onPress={submit}
            loading={submitting}
            disabled={submitting}
            testID="safety-report-submit"
          />
          <Button label={t('womenMode.reportCancel')} variant="ghost" onPress={onClose} disabled={submitting} testID="safety-report-cancel" />
        </View>
      }
    >
      <View style={styles.body}>
        <TextField
          label={t('womenMode.reportNote')}
          value={note}
          onChangeText={setNote}
          placeholder={t('womenMode.reportNotePlaceholder')}
          multiline
          maxLength={SAFETY_NOTE_MAX}
          error={noteError}
          testID="safety-report-note"
        />
        {error ? (
          <AppText variant="bodySmall" color="danger" accessibilityLiveRegion="polite" testID="safety-report-error">
            {error}
          </AppText>
        ) : null}
      </View>
    </BottomSheet>
  );
}

type SectionProps = {
  rideId: number;
  /** Ride `safety_report` (BE-105): the server decides when the button shows. */
  state: SafetyReportState;
  /** After a report was made (or found already made): reload the ride. */
  onReported?: () => void;
  testID?: string;
};

const STATUS_KEYS: Readonly<Record<SafetyReportStatus, TranslationKey>> = {
  open: 'womenMode.reportStatusOpen',
  acknowledged: 'womenMode.reportStatusAcknowledged',
  resolved: 'womenMode.reportStatusResolved',
};

/** "Women's-safety report sent · Received" (the status the safety team set). */
export const safetyReportLine = (status: SafetyReportStatus): string =>
  t('womenMode.reportDoneStatus', { status: t(STATUS_KEYS[status]) });

/**
 * Post-ride "Report a women's-safety issue" (BE-87, passenger receipt): a note, sent to the
 * safety team first (high priority); the driver is never told. BE-105: shown while the ride's
 * `safety_report.can_report` says so; once a report exists (also after reopening the ride) it is
 * a "report sent · status" line instead.
 */
export function SafetyReportSection({ rideId, state, onReported, testID = 'safety-report' }: SectionProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ rideId: number; reported: boolean } | null>(null);
  const action = useSafetyReport(rideId, (reported) => {
    setOpen(false);
    setDone({ rideId, reported });
    onReported?.();
  });
  const finished = done && done.rideId === rideId ? done : null;
  // The server's report wins; right after sending, an open one is shown until the reload lands.
  const reportStatus: SafetyReportStatus | null = state.report?.status ?? (finished?.reported ? 'open' : null);
  if (reportStatus) {
    return (
      <Card variant="outlined" testID={`${testID}-sent`}>
        <View style={styles.row}>
          <Icon name="shield" size={20} color="success" />
          <AppText variant="bodySmall" color="textSecondary" style={styles.flex} testID={`${testID}-status`}>
            {safetyReportLine(reportStatus)}
          </AppText>
        </View>
      </Card>
    );
  }
  if (!state.canReport || finished) return null;
  return (
    <View testID={testID}>
      <Button
        label={t('womenMode.reportButton')}
        variant="outline"
        leadingIcon="womenMode"
        onPress={() => setOpen(true)}
        testID={`${testID}-button`}
      />
      <SafetyReportSheet
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1, minWidth: 0 },
});
