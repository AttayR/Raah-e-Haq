/**
 * App models of the AC tier (T-522; docs/api/CONTRACT_NOTES.md "BE-86"). Raw server shapes are
 * mapped in api.ts; screens only see these.
 */

export type AcReportStatus = 'open' | 'upheld' | 'rejected';

/** The passenger's latest "AC not working" report on a ride (whole rupees). */
export interface AcReport {
  id: number;
  status: AcReportStatus;
  /** What was refunded to the wallet (0 until it is). */
  refundAmount: number;
  /** The AC part of the fare the report refunds when upheld; null when unknown. */
  suggestedRefund: number | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

/** Ride `ac_report` (passenger only, AC rides): whether the button shows, and the latest report. */
export interface AcReportState {
  canReport: boolean;
  report: AcReport | null;
}

export interface AcReportResult {
  report: AcReport | null;
  /** The server's thank-you (display-safe, written for people). */
  message: string | null;
}

/**
 * GET /public/vehicle-types `meta` for driver registration (BE-105): which vehicle type may
 * declare AC and from which model year, and the accepted model-year range.
 */
export interface RegistrationVehicleRules {
  /** The type that may declare AC (`car`). */
  acVehicleType: string;
  /** Oldest model year that may declare AC; null when the server did not say. */
  acMinVehicleYear: number | null;
  /** Accepted model years (inclusive); null when the server did not say. */
  vehicleYear: { min: number; max: number } | null;
  /** BE-108: the Make list per vehicle kind; null when the server sent none (older server). */
  vehicleMakes: VehicleMakesByKind | null;
}

/** BE-108: make names per vehicle kind (`car`, `bike`, `rickshaw`, `van`), each ending in "Other". */
export type VehicleMakesByKind = Readonly<Record<string, readonly string[]>>;

/** The vehicle kinds GET /public/vehicle-types always lists in `meta.vehicle_makes` (BE-108). */
export type VehicleMakeKind = 'car' | 'bike' | 'rickshaw' | 'van';

/** One item of GET /public/vehicle-types `data` as sent; only the parts registration reads. */
export interface PublicVehicleTypeWire {
  key: string;
  label?: string;
  /** BE-108: the makes of this kind (`[]` for the car_ac and parcel tiers). */
  makes?: string[];
}

/** GET /public/vehicle-types `meta` as sent (BE-60, BE-105, BE-108). */
export interface PublicVehicleTypesMetaWire {
  ac?: { vehicle_type?: string; min_vehicle_year?: number | null };
  vehicle_year?: { min?: number; max?: number };
  /** BE-108: every vehicle kind is present (active or not); ride tiers are never keys. */
  vehicle_makes?: Partial<Record<VehicleMakeKind, string[]>>;
}

/** The whole GET /public/vehicle-types body as sent (read defensively by toRegistrationVehicleRules). */
export interface PublicVehicleTypesWire {
  success?: boolean;
  data?: PublicVehicleTypeWire[];
  meta?: PublicVehicleTypesMetaWire;
}

/** `vehicle.ac_status` of the driver's car. */
export type VehicleAcStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';

/** One thing still missing before the car gets AC rides (`problems[]`). */
export interface VehicleAcProblem {
  code: string;
  message: string;
}

/** GET/POST /driver/vehicle/ac `data`. */
export interface VehicleAcSummary {
  /** The driver's own (primary) vehicle; null when they have none yet. */
  vehicle: {
    id: number;
    vehicleType: string | null;
    year: number | null;
    hasAc: boolean;
    acStatus: VehicleAcStatus;
    /** The admin's reason, only for a rejection or a suspension. */
    acReason: string | null;
  } | null;
  minVehicleYear: number | null;
  /** The car gets AC ride requests right now. */
  servesAcRides: boolean;
  problems: VehicleAcProblem[];
}
