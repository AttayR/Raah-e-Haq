import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CANCEL_NOTE_MAX_LENGTH, CANCEL_NOTE_MIN_LENGTH } from '../../features/driver-ride/api';
import { DRIVER_RIDE_COPY as COPY } from '../../features/driver-ride/copy';
import type { DriverCancelMode } from '../../features/driver-ride/noShow';
import { t } from '../../i18n';
import { layout, motionPatterns, space } from '../../theme';
import { formatMoney } from '../../utils/format';
import { AppText, Banner, BottomSheet, Button, TextField } from '../ui';

type Props = {
  visible: boolean;
  /** The cancel request is in flight. */
  submitting: boolean;
  /** May return the request's promise: the sheet then allows another try only once it settles. */
  onSubmit: (note: string) => void | Promise<unknown>;
  onClose: () => void;
  /**
   * BE-85: `strike` (default) warns that a cancel after accepting records a strike; `no_show`
   * ("Passenger didn't come", after the wait) records none and starts with a note filled in.
   */
  mode?: DriverCancelMode;
  /** The no-show fee the passenger pays, only while fees are on; null hides the line. */
  noShowFee?: number | null;
  /**
   * The no-show wait is over: a cancel now records no strike (BE-85), so the strike warning is
   * replaced by a pointer to "Passenger didn't come".
   */
  noShowAvailable?: boolean;
  /** T-569: a parcel ride, where the sender (not a passenger) sees the note. */
  parcel?: boolean;
};

type Shown = Required<Pick<Props, 'mode' | 'noShowFee' | 'noShowAvailable' | 'parcel'>>;

/** True when the trimmed note fits the server's 3-500 characters (BE-04 driverCancel). */
export const isValidCancelNote = (note: string): boolean => {
  const length = note.trim().length;
  return length >= CANCEL_NOTE_MIN_LENGTH && length <= CANCEL_NOTE_MAX_LENGTH;
};

/**
 * Asks the driver why they cancel (T-405). The server requires a note of 3-500 characters and
 * shows it to the passenger; the sheet will not submit anything shorter.
 *
 * [T-573] A kit modal BottomSheet (one root Modal at a time, closing guard, keyboard handling).
 * Its destructive button can cancel a ride with a fee, so it fires only for a deliberate tap:
 * never once "Keep ride" or a close has started, not while the sheet is still rising, and once
 * per opening (again only after a refused request has settled).
 */
export const CancelReasonSheet: React.FC<Props> = ({ visible, submitting, onSubmit, onClose, mode = 'strike', noShowFee = null, noShowAvailable = false, parcel = false }) => {
  // [T-573] While it slides out the sheet keeps the copy it was opened with: the parent drops
  // the mode as soon as it closes, which flipped a no-show sheet to the strike cancel mid-slide.
  const [shown, setShown] = useState<Shown>({ mode, noShowFee, noShowAvailable, parcel });
  if (visible && (shown.mode !== mode || shown.noShowFee !== noShowFee || shown.noShowAvailable !== noShowAvailable || shown.parcel !== parcel)) {
    setShown({ mode, noShowFee, noShowAvailable, parcel });
  }
  const noShow = shown.mode === 'no_show';
  const forParcel = shown.parcel;
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const valid = isValidCancelNote(note);

  // [T-573] Synchronous guards (refs: a second tap can arrive before React re-renders).
  const closingRef = useRef(!visible);
  const sentRef = useRef(false);
  /**
   * Taps on the destructive button count from this time on (the sheet has risen). Never armed
   * until the sheet is first placed on screen: before that it is off-screen and still rising.
   */
  const armedAtRef = useRef(Number.POSITIVE_INFINITY);
  /** The sheet is on screen (placed and not yet gone): a reopen then rises from mid-slide. */
  const onScreenRef = useRef(false);
  /** Opened from off-screen: the first placement starts the arming window. */
  const awaitingPlacementRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      closingRef.current = true;
      awaitingPlacementRef.current = false;
      return;
    }
    closingRef.current = false;
    sentRef.current = false;
    if (onScreenRef.current) {
      // Reopened while still sliding out: it rises from there (no new placement), so arm from
      // now. A later snap (keyboard, content height) must not re-arm it.
      armedAtRef.current = Date.now() + motionPatterns.destructiveArmMs;
      awaitingPlacementRef.current = false;
    } else {
      armedAtRef.current = Number.POSITIVE_INFINITY;
      awaitingPlacementRef.current = true;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setNote(noShow ? (forParcel ? t('driverFare.noShowNoteParcel') : t('driverFare.noShowNote')) : '');
    setTouched(false);
  }, [visible, noShow, forParcel]);

  const onSnapChange = useCallback(() => {
    onScreenRef.current = true;
    if (!awaitingPlacementRef.current) return;
    awaitingPlacementRef.current = false;
    armedAtRef.current = Date.now() + motionPatterns.destructiveArmMs;
  }, []);
  const onHidden = useCallback(() => {
    onScreenRef.current = false;
    armedAtRef.current = Number.POSITIVE_INFINITY;
  }, []);

  const keep = () => {
    closingRef.current = true;
    onClose();
  };

  const submit = () => {
    if (!visible || closingRef.current || sentRef.current || submitting) return;
    if (Date.now() < armedAtRef.current) return;
    setTouched(true);
    if (!valid) return;
    sentRef.current = true;
    const request = onSubmit(note.trim());
    if (request) {
      // A refused cancel leaves the sheet up: the driver may try again once it has settled.
      request.then(
        () => {
          sentRef.current = false;
        },
        () => {
          sentRef.current = false;
        },
      );
    }
  };

  const title = noShow ? (forParcel ? t('driverFare.noShowTitleParcel') : t('driverFare.noShowTitle')) : COPY.cancelTitle;
  const hint = noShow
    ? forParcel
      ? t('driverFare.noShowHintParcel')
      : t('driverFare.noShowHint')
    : forParcel
      ? COPY.cancelHintParcel
      : COPY.cancelHint;
  const fee = shown.noShowFee;

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      // A cancel in flight is not abandoned by a scrim tap, Android back or a drag (like Keep).
      dismissible={!submitting}
      onSnapChange={onSnapChange}
      onHidden={onHidden}
      accessibilityLabel={title}
      testID="cancel-reason-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {hint}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={submitting ? COPY.working : noShow ? t('driverFare.noShowSubmit') : COPY.cancelSubmit}
            variant="destructive"
            size="lg"
            onPress={submit}
            loading={submitting}
            testID="cancel-reason-submit"
          />
          <Button label={COPY.cancelKeep} variant="ghost" onPress={keep} disabled={submitting} testID="cancel-reason-keep" />
        </View>
      }
    >
      <View style={styles.body}>
        {noShow ? (
          fee !== null && fee > 0 ? (
            <Banner
              tone="info"
              text={t(forParcel ? 'driverFare.noShowFeeParcel' : 'driverFare.noShowFee', { amount: formatMoney(fee) })}
              testID="cancel-reason-no-show-fee"
            />
          ) : null
        ) : shown.noShowAvailable ? (
          <Banner tone="info" text={forParcel ? t('driverFare.noShowPointerParcel') : t('driverFare.noShowPointer')} testID="cancel-reason-no-show-pointer" />
        ) : (
          <Banner tone="warning" text={t('driverFare.strikeWarning')} testID="cancel-reason-strike" />
        )}
        <View>
          <TextField
            value={note}
            onChangeText={setNote}
            onBlur={() => setTouched(true)}
            placeholder={forParcel ? COPY.cancelPlaceholderParcel : COPY.cancelPlaceholder}
            maxLength={CANCEL_NOTE_MAX_LENGTH}
            multiline
            doneBar
            disabled={submitting}
            error={touched && !valid ? COPY.cancelTooShort : null}
            accessibilityLabel={COPY.cancelTitle}
            testID="cancel-reason"
          />
          <AppText variant="caption" color="textMuted" style={styles.counter}>
            {`${note.length}/${CANCEL_NOTE_MAX_LENGTH}`}
          </AppText>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: { gap: space[1], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  body: { gap: space[3], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  footer: { gap: space[2] },
  counter: { alignSelf: 'flex-end', marginTop: space[1] },
});

export default CancelReasonSheet;
