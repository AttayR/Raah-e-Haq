import React, { useMemo } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from '../../../store/rootReducer';
import type { User } from '../../../services/api';
import { View, StyleSheet } from 'react-native';
import AccountStatusScreen from '../../auth/screens/AccountStatusScreen';
import { AccountStatusLayout } from '../../auth/components/AccountStatusLayout';
import { accountStatusView } from '../../auth/accountStatus';
import { DriverDocumentsList } from '../../driverDocuments/components/DriverDocumentsList';
import type { DriverDocument } from '../../driverDocuments/types';
import { DRIVER_DOCUMENTS_COPY } from '../../driverDocuments/copy';
import { PermissionPrimerScreen } from '../../permissions/PermissionPrimerScreen';
import { DriveSheetBody } from '../../../components/driver/drive/DriveSheet';
import { Screen } from '../../../components/ui';
import SplashScreen from '../../../components/SplashScreen';
import { layout, space } from '../../../theme';

/**
 * Debug kit gallery: the account-status screen (T-106, UI-R8) in each status, rendered by the real
 * screen over a throw-away store that holds a fixture user, so no sign-in is needed for
 * screenshots, and the permission pre-prompt pages. Gallery only; the app never imports this.
 * `-RHKitGallerySection screen-status-<variant>` / `screen-primer-<kind>`.
 */
const noop = () => {};

const fixtureUser = (patch: Partial<User>): User => ({
  id: 9001,
  name: 'Ali Raza',
  email: 'gallery@example.test',
  phone: '+923000000000',
  status: 'pending',
  role: 'passenger',
  roles: ['passenger'],
  ...patch,
});

function AccountStatusPreview({ user, statusUnverified = false }: { user: User; statusUnverified?: boolean }) {
  const store = useMemo(() => {
    const base = rootReducer(undefined, { type: '@@gallery/init' });
    return configureStore({
      reducer: rootReducer,
      preloadedState: {
        ...base,
        apiAuth: { ...base.apiAuth, user, isAuthenticated: true, isInitialized: true, statusUnverified },
      },
      middleware: getDefault => getDefault({ serializableCheck: false }),
    });
  }, [user, statusUnverified]);
  return (
    <Provider store={store}>
      <AccountStatusScreen />
    </Provider>
  );
}

/** Pending driver documents as GET /driver/documents returns them (fixture, no network). */
const FIXTURE_DOCUMENTS: DriverDocument[] = [
  { type: 'license', required: true, status: 'rejected', rejectionReason: 'Photo is blurry, please re-upload', canUpload: true },
  { type: 'cnic_back', required: true, status: 'pending', rejectionReason: null, canUpload: false },
  { type: 'vehicle_front', required: false, status: 'missing', rejectionReason: null, canUpload: true },
  { type: 'profile', required: true, status: 'approved', rejectionReason: null, canUpload: false },
  { type: 'cnic_front', required: true, status: 'approved', rejectionReason: null, canUpload: false },
];

/** The real layout over fixture state: pending driver with documents loaded, or the support sheet up. */
function AccountStatusLayoutPreview({ support = false, failed = false }: { support?: boolean; failed?: boolean }) {
  const user = fixtureUser({ name: 'Bilal Ahmed', role: 'driver', roles: ['driver'] });
  const view = accountStatusView(user, false);
  return (
    <AccountStatusLayout
      view={view}
      name={user.name}
      checking={false}
      error={null}
      isLoggingOut={false}
      onCheckStatus={noop}
      onSignOut={noop}
      initialSupportOpen={support}
      documents={
        <DriverDocumentsList
          documents={failed ? [] : FIXTURE_DOCUMENTS}
          allRequiredApproved={false}
          loading={false}
          error={failed ? DRIVER_DOCUMENTS_COPY.loadFailed : null}
          uploadingType={null}
          onRetry={noop}
          onUpload={noop}
        />
      }
    />
  );
}

/** The Drive sheet body with location refused (UI-R8 denied state), on the screen background. */
function DriveLocationNeededPreview() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.sheet}>
        <DriveSheetBody
          status="offline"
          busy={false}
          disabled={false}
          onToggle={noop}
          hasRide={false}
          onResume={noop}
          todayEarnings={null}
          today={{ earnings: null, trips: null, rating: null }}
          statsError={null}
          isApproved
          vehicleType="car"
          locationBlocked={{ onOpenSettings: noop, onRetry: noop }}
        />
      </View>
    </Screen>
  );
}

export const AUTH_STATE_PREVIEWS: Array<[string, () => React.ReactElement]> = [
  ['screen-status-pending', () => <AccountStatusPreview user={fixtureUser({})} />],
  [
    'screen-status-rejected',
    () => <AccountStatusPreview user={fixtureUser({ status: 'rejected', rejection_reason: 'Your CNIC photo did not match your profile photo.' })} />,
  ],
  ['screen-status-suspended', () => <AccountStatusPreview user={fixtureUser({ status: 'suspended' })} />],
  ['screen-status-pending-driver', () => <AccountStatusLayoutPreview />],
  ['screen-status-support', () => <AccountStatusLayoutPreview support />],
  ['screen-status-documents-error', () => <AccountStatusLayoutPreview failed />],
  ['screen-drive-location-needed', () => <DriveLocationNeededPreview />],
  ['screen-splash', () => <SplashScreen />],
  ['screen-status-inactive', () => <AccountStatusPreview user={fixtureUser({ status: 'inactive' })} />],
  ['screen-primer-location', () => <PermissionPrimerScreen kind="locationPassenger" role="passenger" onContinue={noop} onNotNow={noop} />],
  ['screen-primer-location-driver', () => <PermissionPrimerScreen kind="locationDriver" role="driver" onContinue={noop} onNotNow={noop} />],
  ['screen-primer-notifications', () => <PermissionPrimerScreen kind="notifications" role="passenger" onContinue={noop} onNotNow={noop} />],
  ['screen-primer-notifications-driver', () => <PermissionPrimerScreen kind="notifications" role="driver" onContinue={noop} onNotNow={noop} />],
  ['screen-status-unverified', () => <AccountStatusPreview user={fixtureUser({ status: 'active' })} statusUnverified />],
];

const styles = StyleSheet.create({
  sheet: { padding: layout.gutter, paddingTop: space[6] },
});
