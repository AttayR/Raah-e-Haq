import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { AppTheme } from '../../theme';
import { CANCEL_NOTE_MAX_LENGTH, CANCEL_NOTE_MIN_LENGTH } from '../../features/driver-ride/api';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';

type Props = {
  visible: boolean;
  /** The cancel request is in flight. */
  submitting: boolean;
  onSubmit: (note: string) => void;
  onClose: () => void;
};

/** True when the trimmed note fits the server's 3-500 characters (BE-04 driverCancel). */
export const isValidCancelNote = (note: string): boolean => {
  const length = note.trim().length;
  return length >= CANCEL_NOTE_MIN_LENGTH && length <= CANCEL_NOTE_MAX_LENGTH;
};

/**
 * Asks the driver why they cancel (T-405). The server requires a note of 3-500 characters and
 * shows it to the passenger; the sheet will not submit anything shorter.
 */
export const CancelReasonSheet: React.FC<Props> = ({ visible, submitting, onSubmit, onClose }) => {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = isValidCancelNote(note);

  useEffect(() => {
    if (!visible) {
      setNote('');
      setTouched(false);
    }
  }, [visible]);

  const submit = () => {
    setTouched(true);
    if (valid && !submitting) onSubmit(note.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet} testID="cancel-reason-sheet">
          <Text style={styles.title} accessibilityRole="header">{COPY.cancelTitle}</Text>
          <Text style={styles.hint}>{COPY.cancelHint}</Text>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            onBlur={() => setTouched(true)}
            placeholder={COPY.cancelPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={CANCEL_NOTE_MAX_LENGTH}
            multiline
            editable={!submitting}
            accessibilityLabel={COPY.cancelTitle}
            testID="cancel-reason-input"
          />
          <View style={styles.metaRow}>
            <Text style={styles.error} testID="cancel-reason-error">
              {touched && !valid ? COPY.cancelTooShort : ''}
            </Text>
            <Text style={styles.counter}>{`${note.length}/${CANCEL_NOTE_MAX_LENGTH}`}</Text>
          </View>
          <TouchableOpacity
            style={[styles.submit, (!valid || submitting) && styles.disabled]}
            onPress={submit}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid || submitting, busy: submitting }}
            testID="cancel-reason-submit"
          >
            {submitting && <ActivityIndicator size="small" color={theme.colors.onPrimary} style={styles.spinner} />}
            <Text style={styles.submitText}>{submitting ? COPY.working : COPY.cancelSubmit}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.keep}
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button"
            testID="cancel-reason-keep"
          >
            <Text style={styles.keepText}>{COPY.cancelKeep}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlay,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: theme.space[5],
      paddingBottom: theme.space[8],
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    hint: {
      ...theme.typography.bodySmall,
      color: theme.colors.textSecondary,
      marginTop: theme.space[1],
      marginBottom: theme.space[3],
    },
    input: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.space[3],
      textAlignVertical: 'top',
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.space[1],
      marginBottom: theme.space[3],
    },
    error: {
      ...theme.typography.caption,
      color: theme.colors.danger,
      flex: 1,
    },
    counter: {
      ...theme.typography.caption,
      color: theme.colors.textMuted,
    },
    submit: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: theme.layout.touchTargetDriving,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.dangerFill,
    },
    submitText: {
      ...theme.typography.button,
      color: theme.colors.onPrimary,
    },
    spinner: {
      marginRight: theme.space[2],
    },
    keep: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: theme.layout.touchTargetDriving,
      marginTop: theme.space[2],
    },
    keepText: {
      ...theme.typography.buttonSmall,
      color: theme.colors.primaryText,
    },
    disabled: {
      opacity: 0.4,
    },
  });

export default CancelReasonSheet;
