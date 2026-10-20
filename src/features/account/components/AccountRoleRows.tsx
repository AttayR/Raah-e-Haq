import React from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { User } from '../../../services/api';
import { Badge, ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { DriverWomenModeRow } from '../../women-mode/components/DriverWomenModeRow';
import { toDriverWomenMode } from '../../women-mode/api';
import { showParcelOptInRow, useParcelOptInSummary } from '../../parcel/hooks';
import { peekMyVehicles } from '../../driver-profile/hooks';
import { documentsNeedAction } from '../rules';
import type { AccountNavigator, AccountRole } from '../navigation';

type Props = {
  role: AccountRole;
  user: User | null;
  navigation: AccountNavigator;
  /** `passenger-settings` / `driver-settings`: rows get `${prefix}-<row>`. */
  prefix: string;
};

/** "Your account" (shared-settings §4.1): one-line 64 rows, the per-role ones only. */
export function YourAccountGroup({ role, user, navigation, prefix }: Props) {
  if (role === 'passenger') {
    return (
      <ListGroup title={t('account.groupYourAccount')} testID={`${prefix}-group-account`}>
        <ListItem
          icon="bookmark"
          title={t('savedPlaces.title')}
          onPress={() => navigation.navigate('FavoriteLocations')}
          testID={`${prefix}-saved-places`}
        />
      </ListGroup>
    );
  }
  return <DriverAccountGroup role={role} user={user} navigation={navigation} prefix={prefix} />;
}

function DriverAccountGroup({ user, navigation, prefix }: Props) {
  const isFocused = useIsFocused();
  // T-561: only a driver whose profile type is not a bike needs the server's word on other vehicles.
  const parcelOptIn = useParcelOptInSummary(isFocused && !showParcelOptInRow(null, user?.vehicle_type));
  // Only what is already in memory: the Account tab never asks for the documents itself.
  const needsAction = documentsNeedAction(peekMyVehicles(), user?.license_expiry_date);
  const documentsTitle = t('account.documents');
  return (
    <ListGroup title={t('account.groupYourAccount')} testID={`${prefix}-group-account`}>
      <ListItem
        icon="idCard"
        title={documentsTitle}
        trailing={needsAction ? <Badge tone="warning" label={t('account.documentsAction')} /> : undefined}
        chevron={!needsAction}
        accessibilityLabel={needsAction ? `${documentsTitle}, ${t('account.documentsAction')}` : undefined}
        onPress={() => navigation.navigate('DriverDocuments')}
        testID={`${prefix}-documents`}
      />
      {/* BE-86: AC is declared on a car (no row for a bike or rickshaw). */}
      {!user?.vehicle_type || user.vehicle_type === 'car' ? (
        <ListItem icon="ac" title={t('ac.rowTitle')} onPress={() => navigation.navigate('VehicleAc')} testID={`${prefix}-vehicle-ac`} />
      ) : null}
      {/* BE-88: parcels go by bike. T-561: any approved bike counts, not only the first vehicle. */}
      {showParcelOptInRow(parcelOptIn, user?.vehicle_type) ? (
        <ListItem
          icon="parcel"
          title={t('parcel.optInRowTitle')}
          onPress={() => navigation.navigate('ParcelOptIn')}
          testID={`${prefix}-parcels`}
        />
      ) : null}
      <ListItem
        icon="history"
        title={t('account.rideHistory')}
        onPress={() => navigation.navigate('RideHistory')}
        testID={`${prefix}-ride-history`}
      />
    </ListGroup>
  );
}

/** "Safety" (shared-settings §4.2): emergency contacts on both roles; a driver's women-mode status. */
export function SafetyGroup({ role, user, navigation, prefix }: Props) {
  // Decided here, so a driver without a women-mode status gets no empty row (and no divider).
  const womenMode = role === 'driver' ? toDriverWomenMode(user?.women_mode) : null;
  const showWomenMode = !!womenMode && (womenMode.suspended || womenMode.eligible);
  return (
    <ListGroup title={t('account.groupSafety')} testID={`${prefix}-group-safety`}>
      <ListItem
        icon="contacts"
        title={t('safety.contactsRow')}
        onPress={() => navigation.navigate('EmergencyContacts')}
        testID={`${prefix}-emergency-contacts`}
      />
      {showWomenMode ? <DriverWomenModeRow raw={user?.women_mode} /> : null}
    </ListGroup>
  );
}
