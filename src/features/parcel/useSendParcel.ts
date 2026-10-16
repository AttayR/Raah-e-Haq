import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { hideModal, showErrorModal } from '../../components/NotificationManager';
import { t } from '../../i18n';
import { reverseGeocode } from '../../services/placesService';
import type { RideResource } from '../../services/rideService';
import { createActiveRide, type ActiveRideState } from '../active-ride/slice';
import { showBalanceOwed } from '../active-ride/hooks';
import { ACTIVE_RIDE_COPY } from '../active-ride/copy';
import { askForPushInContext } from '../notifications/push';
import { displayAddress } from '../passenger-home/greeting';
import { withAddresses, type BookingPlace } from '../ride-booking/buildRideRequest';
import { BOOKING_COPY } from '../ride-booking/copy';
import { useFareEstimates } from '../ride-booking/hooks';
import type { FareEstimate } from '../ride-booking/api';
import { classifyRideRequestFailure } from '../ride-booking/rideRequestFailure';
import { isParcelType } from './api';
import { EMPTY_PARCEL_DRAFT, buildParcelRideRequest, parcelFieldErrorsOf } from './rules';
import type { ParcelDraft, ParcelField, ParcelFieldErrors, ParcelOptions } from './types';

type Dispatch = ThunkDispatch<{ activeRide: ActiveRideState }, unknown, UnknownAction>;
type LatLng = { latitude: number; longitude: number };

/** A parcel goes straight from the pickup to the drop-off (BE-88: no stops). */
const NO_STOPS: ReadonlyArray<LatLng> = [];

export interface SendParcelHandlers {
  /** The parcel was booked (it is now the active ride). */
  onBooked: (ride: RideResource) => void;
  /** BE-37: the passenger's phone is not verified. */
  onPhoneNotVerified: () => void;
  /** BE-85: the passenger owes more than the limit. */
  onBalanceOwed: (amountOwed: number | null) => void;
  /** 422 parcel.rules_version: the rules changed; read the options again. */
  onRulesChanged: () => void;
}

/**
 * The "Send a parcel" form state (T-522, BE-88): the pickup (the sender's position until they
 * choose another) and the drop-off, the draft, the server's parcel quote for that route, and the
 * booking (POST /rides with vehicle_type parcel and the `parcel` block). A 422 puts each message
 * under its field.
 */
export const useSendParcel = (options: ParcelOptions | null, currentLocation: LatLng | null, handlers: SendParcelHandlers) => {
  const dispatch = useDispatch<Dispatch>();
  const [pickup, setPickupState] = useState<BookingPlace | null>(null);
  const [pickupIsGps, setPickupIsGps] = useState(true);
  const [dropoff, setDropoffState] = useState<BookingPlace | null>(null);
  const [draft, setDraft] = useState<ParcelDraft>(EMPTY_PARCEL_DRAFT);
  const [errors, setErrors] = useState<ParcelFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The sender's position is the pickup until they pick another one; its address is resolved once
  // (a late answer is kept only while the pickup is still that point).
  const lat = currentLocation?.latitude;
  const lng = currentLocation?.longitude;
  const gpsTaken = useRef(false);
  useEffect(() => {
    if (!pickupIsGps || gpsTaken.current || lat === undefined || lng === undefined) return;
    gpsTaken.current = true;
    const point = { latitude: lat, longitude: lng };
    setPickupState(point);
    reverseGeocode(point.latitude, point.longitude)
      .then((raw) => {
        const address = raw ? displayAddress(raw) : null;
        if (!mounted.current || !address) return;
        setPickupState((p) => (p && p.latitude === point.latitude && p.longitude === point.longitude ? { ...p, address } : p));
      })
      .catch(() => undefined);
  }, [pickupIsGps, lat, lng]);

  const clearError = useCallback((field: ParcelField) => {
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
    setFormError(null);
  }, []);

  const update = useCallback(
    <K extends keyof ParcelDraft>(key: K, value: ParcelDraft[K], field: ParcelField) => {
      setDraft((d) => ({ ...d, [key]: value }));
      clearError(field);
    },
    [clearError],
  );

  const setPickup = useCallback(
    (place: BookingPlace) => {
      setPickupIsGps(false);
      setPickupState(place);
      clearError('pickup');
    },
    [clearError],
  );

  const setDropoff = useCallback(
    (place: BookingPlace) => {
      setDropoffState(place);
      clearError('dropoff');
    },
    [clearError],
  );

  /** The rules changed: the sender reads them again and confirms again. */
  const resetDeclaration = useCallback(() => setDraft((d) => ({ ...d, declarationAccepted: false })), []);

  const estimates = useFareEstimates(pickup, dropoff, NO_STOPS);
  const quote: FareEstimate | null = useMemo(
    () => estimates.data?.estimates.find((e) => isParcelType(e) || (options !== null && e.vehicle_type === options.vehicleType)) ?? null,
    [estimates.data, options],
  );

  const submit = useCallback(async () => {
    if (!options || inFlight.current) return;
    // Taken before the geocode await, so a second tap meanwhile sends nothing (one POST).
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    let built: ReturnType<typeof buildParcelRideRequest>;
    try {
      const [p, d] = await withAddresses([pickup, dropoff], reverseGeocode);
      built = buildParcelRideRequest(p, d, draft, options);
    } catch {
      built = { ok: false, errors: {}, message: t('parcel.fixFields') };
    }
    if (!built.ok) {
      inFlight.current = false;
      if (mounted.current) {
        setSubmitting(false);
        setErrors(built.errors);
        setFormError(built.message ?? t('parcel.fixFields'));
      }
      return;
    }
    try {
      const action = await dispatch(createActiveRide(built.request));
      if (createActiveRide.fulfilled.match(action)) {
        askForPushInContext();
        handlersRef.current.onBooked(action.payload);
        return;
      }
      const rejection = action.payload;
      if (rejection?.kind === 'validation') {
        const mapped = parcelFieldErrorsOf(rejection);
        setErrors(mapped.fields);
        if (mapped.rulesChanged) {
          resetDeclaration();
          handlersRef.current.onRulesChanged();
        }
        setFormError(mapped.other ?? (mapped.rulesChanged ? t('parcel.rulesChanged') : t('parcel.fixFields')));
        return;
      }
      const failure = classifyRideRequestFailure(rejection, ACTIVE_RIDE_COPY.requestFailedFallback);
      if (failure.kind === 'phone_not_verified') {
        showErrorModal(
          BOOKING_COPY.phoneNotVerifiedTitle,
          failure.message,
          { label: BOOKING_COPY.phoneNotVerifiedAction, onPress: () => { hideModal(); handlersRef.current.onPhoneNotVerified(); } },
          { label: BOOKING_COPY.notNow, onPress: hideModal },
        );
      } else if (failure.kind === 'balance_owed') {
        showBalanceOwed(failure, handlersRef.current.onBalanceOwed);
      } else if (failure.kind !== 'handled') {
        setFormError(failure.message);
      }
    } finally {
      inFlight.current = false;
      // Booked: the screen is replaced by the ride, so nothing is set after it is gone.
      if (mounted.current) setSubmitting(false);
    }
  }, [options, pickup, dropoff, draft, dispatch, resetDeclaration]);

  return {
    pickup,
    pickupIsGps,
    setPickup,
    dropoff,
    setDropoff,
    draft,
    update,
    errors,
    formError,
    estimates,
    quote,
    submitting,
    submit,
  };
};

export type SendParcelForm = ReturnType<typeof useSendParcel>;
