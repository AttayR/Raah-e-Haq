import type { NavigationAction } from '@react-navigation/native';

/**
 * Profile editing routes (T-504b). Both role stacks register `ProfileEdit` and `ChangePhone`, so
 * the shared screens and the Account banners open them from either side. No PII travels in the
 * route: the screens read the profile from the store.
 */
export const PROFILE_EDIT_ROUTE = 'ProfileEdit' as const;
export const CHANGE_PHONE_ROUTE = 'ChangePhone' as const;

export type ProfileEditRoutes = {
  ProfileEdit: undefined;
  ChangePhone: undefined;
};

export interface ProfileEditNavigator {
  navigate(name: typeof PROFILE_EDIT_ROUTE | typeof CHANGE_PHONE_ROUTE): void;
  goBack(): void;
  /** Replays the removal the discard guard held back (usePreventRemove). */
  dispatch(action: NavigationAction): void;
}
