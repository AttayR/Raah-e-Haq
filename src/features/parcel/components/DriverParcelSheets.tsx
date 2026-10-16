import React from 'react';
import type { DriverParcelSheetsProps } from '../useDriverParcel';
import { ParcelCodeSheet } from './ParcelCodeSheet';
import { ParcelPickupSheet } from './ParcelPickupSheet';
import { ParcelReasonSheet } from './ParcelReasonSheet';

/** The driver's parcel sheets (pickup, code, return / refuse reason); at most one is open. */
export function DriverParcelSheets({ pickup, code, reason }: DriverParcelSheetsProps) {
  return (
    <>
      <ParcelPickupSheet {...pickup} />
      <ParcelCodeSheet {...code} />
      <ParcelReasonSheet {...reason} />
    </>
  );
}
