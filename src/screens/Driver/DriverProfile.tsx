import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { RootState } from '../../store';
import { AppText, Badge, IconButton, ListGroup, ListItem, Screen, StatTile } from '../../components/ui';
import { PhotoReviewBanner, ProfilePhotoEditor, usePhotoReview } from '../../features/profile-photo';
import { ProfileInfoList } from '../../components/passenger/settings/ProfileInfoList';
import { formatCalendarDate, formatMonthYear } from '../../components/passenger/settings/format';
import { useMyStats } from '../../features/stats/hooks';
import { useMyVehicles } from '../../features/driver-profile/hooks';
import { VehicleCard } from '../../features/driver-profile/components/VehicleCard';
import { toDriverProfileStats } from '../../features/driver-profile/format';
import { DRIVER_PROFILE_COPY as COPY } from '../../features/driver-profile/copy';
import { space } from '../../theme';

/**
 * Driver Profile (T-507, T-514; shared-profile spec, the driver side of PassengerProfile):
 * identity (tappable avatar that changes the photo, T-504; name, "Driver · Member since",
 * approval badge; the photo's review state from GET /driver/documents), the
 * lifetime stats from GET /me/stats (rating "New" until rated, trips, earnings in PKR), the
 * personal info the server sent, the vehicle from GET /profile/documents and the licence from
 * the profile. Nothing is hardcoded; editing the other fields comes with T-504.
 */
const DriverProfile = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const stats = useMyStats(isFocused, COPY.statsFailed);
  const driverStats = stats.data?.role === 'driver' ? stats.data : null;
  const values = toDriverProfileStats(driverStats);
  const vehicles = useMyVehicles(isFocused);
  const photoReview = usePhotoReview(isFocused);

  const name = user?.name?.trim() || COPY.driverFallbackName;
  const since = formatMonthYear(user?.created_at);
  const meta = since ? `${COPY.roleLabel} · ${COPY.memberSince} ${since}` : COPY.roleLabel;
  const approved = user?.status === 'active';
  const licenceNumber = user?.license_number?.trim() || null;
  const licenceExpiry = formatCalendarDate(user?.license_expiry_date);

  return (
    <Screen scroll contentStyle={styles.content} testID="driver-profile">
      <View style={styles.header}>
        <IconButton icon="back" accessibilityLabel={COPY.back} onPress={() => navigation.goBack()} testID="driver-profile-back" />
        <AppText variant="h2" accessibilityRole="header" style={styles.title}>
          {COPY.title}
        </AppText>
      </View>

      <View style={styles.identity} testID="driver-profile-identity">
        <ProfilePhotoEditor
          name={name}
          uri={user?.profile_image_url}
          onUploaded={photoReview.markPending}
          testID="driver-profile-photo"
        />
        <View style={styles.identityText}>
          <AppText variant="h2" align="center" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {meta}
          </AppText>
        </View>
        <Badge
          tone={approved ? 'success' : 'warning'}
          label={approved ? COPY.approved : COPY.pendingApproval}
          testID="driver-profile-status"
        />
        <PhotoReviewBanner review={photoReview.review} />
      </View>

      <View>
        <View style={styles.stats}>
          <StatTile icon="star" value={values.rating} label={COPY.statRating} testID="driver-profile-rating" />
          <StatTile icon="rides" value={values.rides} label={COPY.statRides} testID="driver-profile-rides" />
          <StatTile icon="cash" value={values.earnings} label={COPY.statEarnings} testID="driver-profile-earnings" />
        </View>
        {!driverStats && stats.status === 'failed' ? (
          <AppText variant="bodySmall" color="textSecondary" style={styles.statsError} testID="driver-profile-stats-error">
            {stats.error ?? COPY.statsFailed}
          </AppText>
        ) : null}
      </View>

      <ProfileInfoList user={user} />

      <VehicleCard vehicles={vehicles} vehicleType={user?.vehicle_type} />

      <ListGroup title={COPY.licenceGroup} testID="driver-profile-licence">
        {licenceNumber ? (
          <ListItem icon="document" title={COPY.licenceNumber} subtitle={licenceNumber} testID="driver-profile-licence-number" />
        ) : (
          <ListItem icon="document" title={COPY.noLicence} testID="driver-profile-licence-empty" />
        )}
        {licenceExpiry ? (
          <ListItem icon="calendar" title={COPY.licenceExpiry} subtitle={licenceExpiry} testID="driver-profile-licence-expiry" />
        ) : null}
      </ListGroup>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginStart: -space[2] },
  title: { flex: 1 },
  identity: { alignItems: 'center', gap: space[3], paddingTop: space[2] },
  identityText: { alignItems: 'center', gap: space[1], alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: space[3] },
  statsError: { marginTop: space[2] },
});

export default DriverProfile;
