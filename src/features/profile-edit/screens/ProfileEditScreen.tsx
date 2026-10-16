import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { RootState } from '../../../store';
import {
  AppText,
  Button,
  Header,
  KeyboardAwareScrollView,
  ListGroup,
  ListItem,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { toast } from '../../../core/toast';
import { formatIsoDateInput } from '../../auth/registration/inputFormat';
import { formatPkPhone } from '../../safety/rules';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { ADDRESS_MAX, BIO_MAX, EMAIL_MAX, GENDERS, NAME_MAX, type Gender } from '../form';
import { useProfileEditForm } from '../useProfileEditForm';
import { CHANGE_PHONE_ROUTE, type ProfileEditNavigator } from '../navigation';

const GENDER_OPTIONS = GENDERS.map((value) => ({
  value,
  label: t(value === 'male' ? 'profileEdit.genderMale' : value === 'female' ? 'profileEdit.genderFemale' : 'profileEdit.genderOther'),
}));

/**
 * Edit profile (T-504b; shared-profile "Profile edit"), both roles: name, email, gender, date of
 * birth (a driver's must be 18+, BE-68), address and bio, saved with PUT /profile (only the
 * changed fields). The phone is read-only here: "Change number" opens its own OTP flow (BE-35).
 * A new email waits in `pending_email` and asks for the current password (BE-38). Leaving with
 * unsaved changes asks first. The focused field (and its error) stays above the keyboard and the
 * sticky Save bar (kit KeyboardAwareScrollView, T-545).
 */
export default function ProfileEditScreen() {
  const navigation = useNavigation<ProfileEditNavigator>();
  const user = useSelector((state: RootState) => state.apiAuth.user);
  const edit = useProfileEditForm(user);
  const { form, errors, setField } = edit;
  const [saved, setSaved] = useState(false);
  const isDriver = user?.role === 'driver';

  // Saved: leave once the discard guard is off (it is read on the next render).
  useEffect(() => {
    if (saved) navigation.goBack();
  }, [saved, navigation]);

  usePreventRemove(edit.dirty && !saved, ({ data }) => {
    confirm({
      title: t('profileEdit.discardTitle'),
      body: t('profileEdit.discardBody'),
      confirmLabel: t('profileEdit.discardConfirm'),
      cancelLabel: t('profileEdit.keepEditing'),
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  const onSave = async () => {
    const message = await edit.save();
    if (!message) return;
    toast.success(message);
    setSaved(true);
  };

  return (
    <Screen testID="profile-edit" keyboardAvoiding edges={['top', 'bottom']}>
      <Header
        tone="background"
        title={t('profileEdit.title')}
        backLabel={t('profileEdit.back')}
        onBack={() => navigation.goBack()}
        testID="profile-edit-header"
      />
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="profile-edit-scroll"
      >
        <TextField
          label={t('profileEdit.nameLabel')}
          value={form.name}
          onChangeText={(text) => setField('name', text)}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          error={errors.name}
          disabled={edit.saving}
          testID="profile-edit-name"
        />
        <TextField
          label={t('profileEdit.emailLabel')}
          value={form.email}
          onChangeText={(text) => setField('email', text)}
          maxLength={EMAIL_MAX}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          helper={user?.pending_email ? t('profileEdit.emailPending', { email: user.pending_email }) : undefined}
          error={errors.email}
          disabled={edit.saving}
          testID="profile-edit-email"
        />
        {edit.needsPassword || errors.currentPassword ? (
          <TextField
            variant="password"
            label={t('profileEdit.passwordLabel')}
            helper={t('profileEdit.passwordHelper')}
            value={form.currentPassword}
            onChangeText={(text) => setField('currentPassword', text)}
            autoComplete="current-password"
            textContentType="password"
            error={errors.currentPassword}
            disabled={edit.saving}
            testID="profile-edit-password"
          />
        ) : null}

        <View style={styles.group}>
          <ListGroup title={t('profileEdit.phoneLabel')} testID="profile-edit-phone">
            <ListItem
              icon="phone"
              title={user?.phone ? formatPkPhone(user.phone) : t('profileEdit.phoneNone')}
              value={user?.phone ? t('profileEdit.changeNumber') : t('profileEdit.verifyNumber')}
              accessibilityHint={t('profileEdit.phoneHelper')}
              onPress={() => navigation.navigate(CHANGE_PHONE_ROUTE)}
              testID="profile-edit-change-phone"
            />
          </ListGroup>
          {/* Full width under the row, so it wraps instead of being cut next to "Change number" (T-545). */}
          <AppText variant="caption" color="textSecondary" style={styles.groupHelper} testID="profile-edit-phone-helper">
            {t('profileEdit.phoneHelper')}
          </AppText>
        </View>

        <View style={styles.group}>
          <AppText variant="label" color="textSecondary">
            {t('profileEdit.genderLabel')}
          </AppText>
          <SegmentedControl<Gender | ''>
            options={GENDER_OPTIONS}
            value={form.gender}
            onChange={(value) => setField('gender', value)}
            accessibilityLabel={t('profileEdit.genderLabel')}
            disabled={edit.saving}
            testID="profile-edit-gender"
          />
          {errors.gender ? (
            <AppText variant="bodySmall" color="danger" accessibilityRole="alert">
              {errors.gender}
            </AppText>
          ) : null}
        </View>
        <TextField
          label={t('profileEdit.dobLabel')}
          helper={isDriver ? t('profileEdit.dobDriverHelper') : t('profileEdit.dobHelper')}
          value={form.dateOfBirth}
          onChangeText={(text) => setField('dateOfBirth', formatIsoDateInput(text))}
          keyboardType="number-pad"
          maxLength={10}
          // The number pad and the multiline bio have no return key: each gets its own iOS Done bar.
          doneBar
          error={errors.dateOfBirth}
          disabled={edit.saving}
          testID="profile-edit-dob"
        />
        <TextField
          label={t('profileEdit.addressLabel')}
          value={form.address}
          onChangeText={(text) => setField('address', text)}
          maxLength={ADDRESS_MAX}
          autoComplete="street-address"
          textContentType="fullStreetAddress"
          error={errors.address}
          disabled={edit.saving}
          testID="profile-edit-address"
        />
        <TextField
          label={t('profileEdit.bioLabel')}
          helper={t('profileEdit.bioHelper')}
          value={form.bio}
          onChangeText={(text) => setField('bio', text)}
          maxLength={BIO_MAX}
          multiline
          doneBar
          error={errors.bio}
          disabled={edit.saving}
          testID="profile-edit-bio"
        />
        {edit.formError ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="profile-edit-error">
            {edit.formError}
          </AppText>
        ) : null}
      </KeyboardAwareScrollView>
      <View style={styles.footer}>
        <Button
          label={t('profileEdit.save')}
          onPress={onSave}
          loading={edit.saving}
          disabled={!edit.dirty}
          haptic="impactLight"
          testID="profile-edit-save"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[6],
    gap: space[4],
  },
  group: { gap: space[2] },
  groupHelper: { marginHorizontal: space[4] },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[3],
  },
});
