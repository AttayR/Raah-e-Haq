import React, { memo } from 'react';
import type { DriverParcelSheetsProps } from '../useDriverParcel';
import { ParcelCodeSheet } from './ParcelCodeSheet';
import { ParcelPickupSheet } from './ParcelPickupSheet';
import { ParcelReasonSheet } from './ParcelReasonSheet';

// [T-562] Always mounted on the driver ride screen, so a closed sheet must not re-render with the
// screen (location ticks, timers): each one re-renders only when its own props change.
const PickupSheet = memo(ParcelPickupSheet);
const CodeSheet = memo(ParcelCodeSheet);
const ReasonSheet = memo(ParcelReasonSheet);

/** The driver's parcel sheets (pickup, code, return / refuse reason); at most one is open. */
export function DriverParcelSheets({ pickup, code, reason }: DriverParcelSheetsProps) {
  return (
    <>
      <PickupSheet {...pickup} />
      <CodeSheet {...code} />
      <ReasonSheet {...reason} />
    </>
  );
}
