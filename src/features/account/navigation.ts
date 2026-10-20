/** Which Account tab / Profile screen: the anatomy is shared, a few rows differ (UI-R16). */
export type AccountRole = 'passenger' | 'driver';

/** Routes the Account tab opens; each is registered on the stack of the role that shows its row. */
export type AccountRoute =
  | 'Profile'
  | 'ChangePhone'
  | 'FavoriteLocations'
  | 'DriverDocuments'
  | 'VehicleAc'
  | 'ParcelOptIn'
  | 'RideHistory'
  | 'EmergencyContacts'
  | 'NotificationPreferences'
  | 'Support'
  | 'Invite';

export interface AccountNavigator {
  navigate(name: AccountRoute): void;
}

/** Routes the shared Profile screen opens (both stacks register ProfileEdit and ChangePhone). */
export interface ProfileNavigator {
  navigate(name: 'ProfileEdit' | 'ChangePhone' | 'DriverDocuments'): void;
  goBack(): void;
}
