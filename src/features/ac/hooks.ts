import { useCallback, useEffect, useRef, useState } from 'react';
import { firstFieldMessages, isApiError, toApiError } from '../../core/api/errors';
import { useRemoteData, type RemoteData } from '../../core/api/useRemoteData';
import { toast } from '../../core/toast';
import { t } from '../../i18n';
import { AC_CODES, acApi } from './api';
import type { AcReportResult, VehicleAcSummary } from './types';

const useMountedRef = () => {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
};

/** What a refused AC report says, and whether the ride should be re-read (the button goes). */
export const acReportRefusal = (error: unknown): { message: string; refresh: boolean } => {
  const apiError = toApiError(error);
  switch (apiError.code) {
    case AC_CODES.windowClosed:
      return { message: t('ac.reportWindowClosed'), refresh: true };
    case AC_CODES.alreadyReported:
      return { message: t('ac.reportAlready'), refresh: true };
    case AC_CODES.noDriver:
      return { message: t('ac.reportNoDriver'), refresh: true };
    case AC_CODES.notAcRide:
      return { message: t('ac.reportNotAc'), refresh: true };
    default:
      break;
  }
  // 404: the ride is not the caller's (or gone); nothing more to report here.
  if (apiError.kind === 'not_found') return { message: t('ac.reportFailed'), refresh: true };
  if (apiError.kind === 'validation') {
    return { message: firstFieldMessages(apiError.fieldErrors).note || apiError.message, refresh: false };
  }
  const known = isApiError(error) && apiError.kind !== 'unknown' && apiError.kind !== 'server';
  return { message: known ? apiError.message : t('ac.reportFailed'), refresh: false };
};

export interface AcReportAction {
  submitting: boolean;
  error: string | null;
  /** Resolves true when the report was taken (or the ride says it cannot be any more). */
  submit: (note?: string) => Promise<boolean>;
}

/**
 * POST /rides/{id}/report-ac (BE-86). The server's thank-you (it names the refund) is a toast;
 * `onDone` receives the report (null after a refusal that means no report can be made now).
 */
export const useAcReport = (rideId: number | null, onDone: (result: AcReportResult | null) => void): AcReportAction => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const mounted = useMountedRef();

  const submit = useCallback(
    async (note?: string): Promise<boolean> => {
      if (rideId === null || submitting) return false;
      setSubmitting(true);
      setError(null);
      try {
        const result = await acApi.reportAc(rideId, note);
        toast.success(result.message ?? t('ac.reportSent'));
        onDoneRef.current(result);
        return true;
      } catch (cause: unknown) {
        const refusal = acReportRefusal(cause);
        if (refusal.refresh) {
          toast.info(refusal.message);
          onDoneRef.current(null);
          return true;
        }
        if (mounted.current) setError(refusal.message);
        return false;
      } finally {
        if (mounted.current) setSubmitting(false);
      }
    },
    [rideId, submitting, mounted],
  );

  return { submitting, error, submit };
};

export interface VehicleAcState extends RemoteData<VehicleAcSummary> {
  saving: boolean;
  /** The last refused change, shown on the screen; null after a success or a new attempt. */
  saveError: string | null;
  setHasAc: (hasAc: boolean) => Promise<void>;
}

/** The driver's AC declaration (GET/POST /driver/vehicle/ac), read when the screen is focused. */
export const useVehicleAc = (enabled: boolean): VehicleAcState => {
  const remote = useRemoteData({ fetch: acApi.getVehicleAc, fallbackError: t('ac.loadFailed'), enabled });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mounted = useMountedRef();
  const { setData } = remote;

  const setHasAc = useCallback(
    async (hasAc: boolean) => {
      if (saving) return;
      setSaving(true);
      setSaveError(null);
      try {
        const next = await acApi.setVehicleAc(hasAc);
        if (!mounted.current) return;
        setData(next);
        toast.success(hasAc ? t('ac.declared') : t('ac.removed'));
      } catch (cause: unknown) {
        if (!mounted.current) return;
        const apiError = toApiError(cause);
        // 422 NOT_A_CAR / VEHICLE_TOO_OLD and 409 NO_VEHICLE carry a message written for people.
        const known = apiError.kind !== 'unknown' && apiError.kind !== 'server';
        setSaveError(known ? apiError.message : t('ac.saveFailed'));
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [saving, setData, mounted],
  );

  return { ...remote, saving, saveError, setHasAc };
};
