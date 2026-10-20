import React, { useCallback, useMemo, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { TripSheet, TripStatusHeader, useIsOffline, type PersonAction, type TripSheetHandle } from '../../../components/ui';
import { componentTokens } from '../../../theme';
import type { RideResource } from '../../../services/rideService';
import { t } from '../../../i18n';
import type { RideRatingFields } from '../../rating/types';
import { isParcelRide } from '../../parcel/api';
import { rideChatUnread, unreadBadgeCount, withUnreadA11y } from '../../chat/rideUnread';
import type { DriverParcelPanel } from '../../parcel/useDriverParcel';
import { DRIVER_RIDE_COPY as COPY } from '../copy';
import type { DriverRideAction } from '../slice';
import type { DriverRideStep } from '../steps';
import { driverTargetOf } from './driverTripModel';
import { DriverTripFooter, driverFooterModel, footerHasContent, isUserAction, type DriverFooterInput } from './DriverTripFooter';
import { DriverTripCancel, DriverTripDetails, DriverTripHeader, DriverTripPeek } from './DriverTripSections';
import { DriverCancelledFooter, DriverCancelledHeader, DriverReceiptBody, DriverReceiptFooter, useDriverReceipt } from './DriverReceipt';
import { useDriverTripMoments } from './useDriverTripMoments';

export type DriverTripSheetProps = {
  ride: RideResource;
  step: DriverRideStep;
  pendingAction: DriverRideAction | null;
  /** BE-78 `contact.can_call`: a masked call is possible (no number is ever shown). */
  canCall: boolean;
  calling?: boolean;
  onCall: () => void;
  /** BE-81 `pin_blocked`: no slide, only "Contact support". */
  startBlocked?: boolean;
  onContactSupport?: () => void;
  /** The PIN-aware start (usePinGate). */
  onStart: () => void;
  /** A usable coordinate to hand to the maps app. */
  canNavigate: boolean;
  onNavigate: () => void;
  /** Opens the ride chat (T-510); no Message without it. */
  onMessage?: () => void;
  onArrived: () => void;
  arrivalRefusal?: { title: string; message?: string } | null;
  onComplete: () => void;
  onCompleteStop: (stopId: number) => void;
  /** Opens CancelReasonSheet (strike mode). */
  onCancel: () => void;
  /** BE-85: once offered it replaces Cancel and sits in the footer. */
  onNoShow?: () => void;
  /** BE-88: a parcel's own steps and details. */
  parcel?: DriverParcelPanel | null;
  /** Back to Drive (the receipt's footer and the cancelled state). */
  onDone: () => void;
  /** Patch the ride kept in Redux with the new `my_rating` / `can_rate`. */
  onRatingChange: (rideId: number, fields: RideRatingFields) => void;
  /** UI-R11 weak GPS (the subtitle notice). */
  weakGps?: boolean;
  animatedHeight?: SharedValue<number>;
  onHeightChange?: (height: number) => void;
  onExpandedChange?: (expanded: boolean) => void;
  active?: boolean;
};

/**
 * Call · Message · Navigate (TS5): a missing one leaves the others sharing the width. The Message
 * badge is the ride read's BE-136 `chat.unread_count` (no `/chats` poll, TS11); none without it.
 */
const useDriverActions = (p: DriverTripSheetProps, parcelRide: boolean): PersonAction[] => {
  const { canCall, calling = false, onCall, onMessage, canNavigate, onNavigate, step } = p;
  const unread = rideChatUnread(p.ride);
  return useMemo(() => {
    const actions: PersonAction[] = [];
    if (canCall) {
      actions.push({
        key: 'call',
        icon: 'phone',
        label: calling ? t('safety.calling') : COPY.call,
        accessibilityLabel: parcelRide ? COPY.callA11yParcel : COPY.callA11y,
        accessibilityHint: t('safety.callA11yHint'),
        onPress: onCall,
        disabled: calling,
        testID: 'driver-ride-call',
      });
    }
    if (onMessage) {
      actions.push({
        key: 'message',
        icon: 'chat',
        label: COPY.message,
        accessibilityLabel: withUnreadA11y(parcelRide ? COPY.messageA11yParcel : COPY.messageA11y, unread),
        badgeCount: unreadBadgeCount(unread),
        onPress: onMessage,
        testID: 'driver-ride-message',
      });
    }
    if (canNavigate) {
      const pickup = step === 'to_pickup' || step === 'at_pickup';
      actions.push({ key: 'navigate', icon: 'navigate', label: COPY.navigate, accessibilityLabel: pickup ? COPY.navigatePickupA11y : COPY.navigateA11y, onPress: onNavigate, testID: 'driver-ride-navigate' });
    }
    return actions;
  }, [calling, canCall, canNavigate, onCall, onMessage, onNavigate, parcelRide, step, unread]);
};

/**
 * The driver's trip sheet (UI-R13) on the shared TripSheet kit (shared-trip-sheet TS1–TS8): to the
 * pickup, arrived, on trip, and the receipt (or the cancelled state) in one sheet instance, so a
 * step only swaps content and springs to its new peek. One primary in the footer; Cancel is the
 * last item of the details. Modals (PIN, cancel reasons, parcel steps, SOS) stay on the screen.
 */
export function DriverTripSheet(props: DriverTripSheetProps) {
  const { ride, step, pendingAction, parcel = null, onDone, onRatingChange, weakGps = false } = props;
  const offline = useIsOffline();
  const { height } = useWindowDimensions();
  const compact = height < componentTokens.tripSheet.compactHeight;
  const parcelRide = !!parcel || isParcelRide(ride);
  const actions = useDriverActions(props, parcelRide);
  const sheet = useRef<TripSheetHandle>(null);
  const expand = useCallback(() => sheet.current?.expand(), []);
  const receipt = useDriverReceipt(ride, { onRatingChange, onFinish: onDone, offline });
  useDriverTripMoments(step, ride);

  const summary = step === 'summary';
  const cancelled = step === 'cancelled';
  const ended = summary || cancelled;
  const footerInput: DriverFooterInput = {
    ride,
    step,
    pendingAction,
    startBlocked: props.startBlocked ?? false,
    onContactSupport: props.onContactSupport,
    arrivalRefusal: props.arrivalRefusal ?? null,
    onArrived: props.onArrived,
    onStart: props.onStart,
    onComplete: props.onComplete,
    onCompleteStop: props.onCompleteStop,
    onNoShow: props.onNoShow,
    parcel,
    offline,
  };
  const footerModel = driverFooterModel(footerInput);
  const noShow = step === 'at_pickup' && !!props.onNoShow;
  const cancellable = (step === 'to_pickup' || step === 'at_pickup') && !noShow;

  let header: React.ReactNode;
  let footer: React.ReactNode | undefined;
  if (summary) {
    header = <TripStatusHeader title={receipt.model.title} subtitle={receipt.model.metrics} titleTestID="driver-ride-title"
      subtitleTestID="driver-ride-subtitle"
      testID="driver-ride-header" />;
    footer = <DriverReceiptFooter receipt={receipt} offline={offline} />;
  } else if (cancelled) {
    header = <DriverCancelledHeader ride={ride} />;
    footer = <DriverCancelledFooter onDone={onDone} />;
  } else {
    header = <DriverTripHeader step={step} ride={ride} offline={offline} weakGps={weakGps} compact={compact} />;
    footer = footerHasContent(footerModel) ? <DriverTripFooter model={footerModel} input={footerInput} /> : undefined;
  }
  const stopKey = driverTargetOf(ride, step)?.stop?.n ?? 0;

  return (
    <TripSheet
      ref={sheet}
      mode={ended ? 'receipt' : 'trip'}
      stateKey={`${step}:${stopKey}`}
      header={header}
      peek={
        summary ? (
          <DriverReceiptBody ride={ride} receipt={receipt} />
        ) : cancelled ? null : (
          <DriverTripPeek ride={ride} step={step} compact={compact} actions={actions} onTargetPress={expand} />
        )
      }
      details={ended ? undefined : <DriverTripDetails ride={ride} step={step} parcel={parcel} />}
      detailsEnd={<DriverTripCancel visible={cancellable} parcel={parcelRide} disabled={isUserAction(pendingAction)} onCancel={props.onCancel} />}
      footer={footer}
      animatedHeight={props.animatedHeight}
      onHeightChange={props.onHeightChange}
      onExpandedChange={props.onExpandedChange}
      active={props.active}
      accessibilityLabel={t('kit.sheetHandleA11y')}
      testID="driver-ride-panel"
    />
  );
}
