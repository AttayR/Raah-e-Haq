import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView, View } from 'react-native';
import { useDispatch } from 'react-redux';
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { REVEAL_DELAY_MS } from '../../components/ui/keyboardReveal';
import { t } from '../../i18n';
import { space } from '../../theme';
import { reverseGeocode } from '../../services/placesService';
import type { RideResource } from '../../services/rideService';
import { createActiveRide, type ActiveRideState } from '../active-ride/slice';
import { openActiveBooking, showBalanceOwed, showPhoneNotVerified } from '../active-ride/rideRequestFeedback';
import { ACTIVE_RIDE_COPY } from '../active-ride/copy';
import { askForPushInContext } from '../notifications/push';
import { displayAddress } from '../passenger-home/greeting';
import { withAddresses, type BookingPlace } from '../ride-booking/buildRideRequest';
import { useFareEstimates } from '../ride-booking/hooks';
import type { FareEstimate } from '../ride-booking/api';
import { classifyRideRequestFailure } from '../ride-booking/rideRequestFailure';
import { useBookingAttemptKeys } from '../ride-booking/idempotency';
import { useFareOffer } from '../fare/hooks';
import { isParcelType } from './api';
import { EMPTY_PARCEL_DRAFT, buildParcelRideRequest, parcelFieldErrorsOf } from './rules';
import type { ParcelDraft, ParcelField, ParcelFieldErrors, ParcelOptions } from './types';
import { offerKeepAccount } from '../account-deletion/keepAccount';

type Dispatch = ThunkDispatch<{ activeRide: ActiveRideState }, unknown, UnknownAction>;
type LatLng = { latitude: number; longitude: number };

/** A parcel goes straight from the pickup to the drop-off (BE-88: no stops). */
const NO_STOPS: ReadonlyArray<LatLng> = [];

/**
 * T-578: room kept above the field a refused "Send parcel" scrolls to (the Header is outside the
 * scroll; the form's error shows in the footer), so its label stays readable.
 */
export const PARCEL_FIELD_SCROLL_OFFSET = space[4];

/**
 * When the scroll to the topmost error runs: after the kit TextField's own reveal of a newly red
 * field (REVEAL_DELAY_MS), so a lower field turning red never wins over a red field above it.
 */
export const PARCEL_ERROR_SCROLL_DELAY_MS = REVEAL_DELAY_MS * 2;

/** Gives the field's wrapper a ref, so a refused submit can scroll to it. */
export type ParcelAnchor = (field: ParcelField) => (node: View | null) => void;

/** The fields that have an error, so the form can scroll to the topmost one. */
export const erroredParcelFields = (errors: ParcelFieldErrors): ParcelField[] =>
  (Object.keys(errors) as ParcelField[]).filter((field) => !!errors[field]);

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
 * under its field. T-559: the sender may offer a fare inside the parcel quote's band (BE-83, the
 * same stepper as a ride); an out-of-band 422 moves the offer into the server's band.
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
  // T-578: every refused submit scrolls to the topmost field still in error (also one that was
  // already red, e.g. the declaration checkbox off screen). A new object each time, so the same
  // field is scrolled to again after the sender scrolled away.
  const [scrollTarget, setScrollTarget] = useState<{ fields: ParcelField[] } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  // The form's container in the scroll content, to turn a field's position into a scroll offset.
  const containerRef = useRef<View>(null);
  const containerY = useRef(0);
  const anchors = useRef(new Map<ParcelField, View>());
  const anchorRefs = useRef(new Map<ParcelField, (node: View | null) => void>());
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

  const anchor = useCallback<ParcelAnchor>((field) => {
    let ref = anchorRefs.current.get(field);
    if (!ref) {
      ref = (node: View | null) => {
        if (node) anchors.current.set(field, node);
        else anchors.current.delete(field);
      };
      anchorRefs.current.set(field, ref);
    }
    return ref;
  }, []);

  /** The refused fields as shown: their messages, and a scroll to the topmost one. */
  const showErrors = useCallback((fields: ParcelFieldErrors) => {
    setErrors(fields);
    const errored = erroredParcelFields(fields);
    if (errored.length > 0) setScrollTarget({ fields: errored });
  }, []);

  // Once the errors are rendered (the footer banner may have grown), scroll to the topmost one.
  useEffect(() => {
    if (!scrollTarget) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const nodes = scrollTarget.fields
        .map((field) => anchors.current.get(field))
        .filter((node): node is View => node !== undefined);
      Promise.all(
        nodes.map(
          (node) =>
            new Promise<number | null>((resolve) =>
              node.measureLayout(
                container,
                (_x, y) => resolve(y),
                () => resolve(null),
              ),
            ),
        ),
      ).then((ys) => {
        const measured = ys.filter((y): y is number => y !== null);
        if (cancelled || measured.length === 0) return;
        const offset = containerY.current + Math.min(...measured) - PARCEL_FIELD_SCROLL_OFFSET;
        scrollRef.current?.scrollTo({ y: Math.max(0, offset), animated: true });
      });
    }, PARCEL_ERROR_SCROLL_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scrollTarget]);

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
  const offer = useFareOffer(quote?.offer_band ?? null);
  const offeredFare = offer.offeredFare;
  const applyBand = offer.applyBand;
  // T-583 (BE-113): one Idempotency-Key per "Send parcel" press, kept for a resend after no answer.
  const keys = useBookingAttemptKeys();

  const submit = useCallback(async () => {
    if (!options || inFlight.current) return;
    // Taken before the geocode await, so a second tap meanwhile sends nothing (one POST).
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    let built: ReturnType<typeof buildParcelRideRequest>;
    try {
      const [p, d] = await withAddresses([pickup, dropoff], reverseGeocode);
      built = buildParcelRideRequest(p, d, draft, options, offeredFare);
    } catch {
      built = { ok: false, errors: {}, message: t('parcel.fixFields') };
    }
    if (!built.ok) {
      inFlight.current = false;
      if (mounted.current) {
        setSubmitting(false);
        showErrors(built.errors);
        setFormError(built.message ?? t('parcel.fixFields'));
      }
      return;
    }
    try {
      const action = await dispatch(createActiveRide({ ...built.request, idempotencyKey: keys.keyFor(built.request) }));
      if (createActiveRide.fulfilled.match(action)) {
        keys.settle(false);
        askForPushInContext();
        handlersRef.current.onBooked(action.payload);
        return;
      }
      const rejection = action.payload;
      const failure = classifyRideRequestFailure(rejection, ACTIVE_RIDE_COPY.requestFailedFallback);
      keys.settle(failure.kind === 'message' && failure.uncertain === true);
      if (failure.kind === 'already_active') {
        // BE-113: a ride or parcel is already open; that booking is shown instead.
        const open = await openActiveBooking(dispatch, failure.rideId);
        if (open) handlersRef.current.onBooked(open);
        else if (mounted.current) setFormError(failure.message);
        return;
      }
      if (failure.kind === 'offer_out_of_band') {
        // BE-83: the offer left the band (the fare moved); the stepper moves into the new band.
        applyBand(failure.band);
        setFormError(failure.message);
        return;
      }
      if (rejection?.kind === 'validation') {
        const mapped = parcelFieldErrorsOf(rejection);
        showErrors(mapped.fields);
        if (mapped.rulesChanged) {
          resetDeclaration();
          handlersRef.current.onRulesChanged();
        }
        setFormError(mapped.other ?? (mapped.rulesChanged ? t('parcel.rulesChanged') : t('parcel.fixFields')));
        return;
      }
      if (failure.kind === 'phone_not_verified') {
        showPhoneNotVerified(failure.message, () => handlersRef.current.onPhoneNotVerified());
      } else if (failure.kind === 'balance_owed') {
        showBalanceOwed(failure, handlersRef.current.onBalanceOwed);
      } else if (failure.kind === 'deletion_scheduled') {
        offerKeepAccount(dispatch, 'booking').catch(() => undefined);
      } else if (failure.kind !== 'handled') {
        setFormError(failure.message);
      }
    } finally {
      inFlight.current = false;
      // Booked: the screen is replaced by the ride, so nothing is set after it is gone.
      if (mounted.current) setSubmitting(false);
    }
  }, [options, pickup, dropoff, draft, offeredFare, applyBand, dispatch, resetDeclaration, showErrors, keys]);

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
    offer,
    submitting,
    submit,
    scrollRef,
    containerRef,
    containerY,
    anchor,
  };
};

export type SendParcelForm = ReturnType<typeof useSendParcel>;
