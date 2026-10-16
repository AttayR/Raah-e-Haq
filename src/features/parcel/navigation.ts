/** Parcel routes of T-522 (BE-88): the passenger's form and the driver's Account opt-in. */
export type ParcelPassengerRoutes = {
  /** Home → "Send a parcel": route, receiver, item, declaration and the fare; books the parcel. */
  SendParcel: undefined;
};

export type ParcelDriverRoutes = {
  /** Account → Parcel deliveries: opt in to parcel requests and accept the rules. */
  ParcelOptIn: undefined;
};
