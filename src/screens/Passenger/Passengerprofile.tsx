import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { RootState } from '../../store';
import { AppText, Button, IconButton, Screen } from '../../components/ui';
import { ProfileIdentity } from '../../components/passenger/settings/ProfileIdentity';
import { ProfileInfoList } from '../../components/passenger/settings/ProfileInfoList';
import { PASSENGER_SETTINGS_COPY as COPY } from '../../components/passenger/settings/copy';
import { AccountChecks, CHANGE_PHONE_ROUTE, PROFILE_EDIT_ROUTE, type ProfileEditNavigator } from '../../features/profile-edit';
import { t } from '../../i18n';
import { space } from '../../theme';

/**
 * Passenger Profile view (T-618 passenger side, shared-profile spec): who you are, from the
 * signed-in user the server sent. No invented numbers: rating and ride count are not in the
 * user payload yet (BE-15), so there is no stats row. "Edit" opens the profile form and the
 * banners say what the account still needs (verify the number, confirm the email; T-504b).
 * Wallet, saved places and ride history live in Settings, so they are not repeated here.
 */
const PassengerProfile = () => {
  const navigation = useNavigation<ProfileEditNavigator>();
  const { user } = useSelector((state: RootState) => state.apiAuth);

  return (
    <Screen scroll contentStyle={styles.content} testID="passenger-profile">
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel={COPY.back}
          onPress={() => navigation.goBack()}
          testID="passenger-profile-back"
        />
        <AppText variant="h2" accessibilityRole="header" style={styles.title}>
          {COPY.profileTitle}
        </AppText>
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          label={t('profileEdit.edit')}
          accessibilityLabel={t('profileEdit.editA11y')}
          onPress={() => navigation.navigate(PROFILE_EDIT_ROUTE)}
          testID="passenger-profile-edit"
        />
      </View>

      <ProfileIdentity user={user} />
      <AccountChecks user={user} onOpenPhone={() => navigation.navigate(CHANGE_PHONE_ROUTE)} testID="passenger-profile-checks" />
      <ProfileInfoList user={user} />
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
});

export default PassengerProfile;
