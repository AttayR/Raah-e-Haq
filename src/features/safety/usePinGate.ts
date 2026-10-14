import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { SUPPORT_EMAIL } from '../../config/support';
import { haptics } from '../../core/haptics';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import type { RideResource } from '../../services/rideService';
import type { DriverStartResult } from '../driver-ride/hooks';
import { useSecondsLeft } from './hooks';
import type { PinRefusal } from './pin';

export interface PinGate {
  /** The PIN sheet is open. */
  open: boolean;
  submitting: boolean;
  error: string | null;
  lockedSeconds: number;
  blocked: boolean;
  /** Bumped after each refusal (the sheet clears its boxes). */
  attempt: number;
  /** "Start trip": the PIN sheet when the ride needs it (or is blocked), else a plain start. */
  onStartPressed: () => void;
  submit: (pin: string) => void;
  close: () => void;
  contactSupport: () => void;
}

const errorText = (refusal: PinRefusal): string | null => {
  switch (refusal.kind) {
    case 'invalid':
      if (refusal.attemptsLeft === 1) return t('safety.pinAttemptLeft');
      return refusal.attemptsLeft !== null ? t('safety.pinAttemptsLeft', { count: refusal.attemptsLeft }) : t('safety.pinInvalid');
    case 'required':
      return t('safety.pinRequired');
    case 'malformed':
      return t('safety.pinMalformed');
    default:
      return null;
  }
};

/**
 * The driver's start-trip PIN (T-520, BE-81). While the ride says `pin_required`, "Start trip"
 * opens the PIN sheet and the PIN goes with POST /rides/{id}/start; a start the server refuses
 * with PIN_REQUIRED opens it too. PIN_INVALID shows the attempts left, PIN_LOCKED counts down
 * from `retry_after` (the entry is disabled meanwhile), `pin_blocked` (set by the slice on a
 * PIN_BLOCKED answer, cleared by a refresh once an admin lifts it) hides the entry for "Contact
 * support". The lock survives closing and reopening the sheet.
 */
export const usePinGate = (
  ride: Pick<RideResource, 'id' | 'pin_required' | 'pin_blocked'> | null,
  start: (pin?: string) => Promise<DriverStartResult>,
): PinGate => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lockedSeconds = useSecondsLeft(lockedUntil);
  const rideId = ride?.id ?? null;
  // Only the server's flag: the slice sets it on a PIN_BLOCKED answer, and a refresh after an
  // admin cleared the block brings `pin_blocked: false` back, so Start trip shows again.
  const blocked = ride?.pin_blocked === true;

  // Another ride starts clean.
  useEffect(() => {
    setOpen(false);
    setError(null);
    setLockedUntil(null);
  }, [rideId]);

  const refused = useCallback((refusal: PinRefusal | null) => {
    if (!refusal) return;
    haptics.notificationError();
    setOpen(true);
    setAttempt((n) => n + 1);
    if (refusal.kind === 'locked') {
      setLockedUntil(Date.now() + refusal.retryAfterSeconds * 1000);
      setError(null);
    } else if (refusal.kind === 'blocked') {
      setError(null);
    } else {
      setError(errorText(refusal));
    }
  }, []);

  const onStartPressed = useCallback(() => {
    if (ride?.pin_required || blocked) {
      setOpen(true);
      return;
    }
    start().then((result) => {
      if (!result.ok) refused(result.pin);
    });
  }, [ride?.pin_required, blocked, start, refused]);

  const submit = useCallback(
    (pin: string) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      start(pin)
        .then((result) => {
          if (result.ok) {
            setOpen(false);
            setLockedUntil(null);
          } else {
            refused(result.pin);
          }
        })
        .finally(() => setSubmitting(false));
    },
    [submitting, start, refused],
  );

  const close = useCallback(() => {
    if (!submitting) setOpen(false);
  }, [submitting]);

  const contactSupport = useCallback(() => {
    const subject = encodeURIComponent(t('safety.supportSubject', { id: rideId ?? '' }));
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() =>
      toast.info(t('safety.supportFailed', { email: SUPPORT_EMAIL })),
    );
  }, [rideId]);

  return { open, submitting, error, lockedSeconds, blocked, attempt, onStartPressed, submit, close, contactSupport };
};
