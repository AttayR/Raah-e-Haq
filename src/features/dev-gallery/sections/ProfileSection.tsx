import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Banner, Button, ListGroup, ListItem } from '../../../components/ui';
import { ProfileInfoList } from '../../../components/passenger/settings/ProfileInfoList';
import type { User } from '../../../services/api';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/** Dev-only sample profile (no real person): only a long address and bio, to show the full-text rows. */
const SAMPLE: User = {
  id: 0,
  name: 'Sample Rider',
  email: '',
  email_verified: true,
  phone: null,
  pending_phone: null,
  pending_email: null,
  status: 'active',
  role: 'passenger',
  roles: ['passenger'],
  address: 'House 12, Street 4, Block C, Model Town, Lahore',
  bio: 'Usually ride to the office in Gulberg on weekday mornings. Prefer AC cars and quiet rides.',
};

/** T-545 evidence: the Edit profile / Profile parts changed by the QA fixes. */
export function ProfileSection() {
  return (
    <GallerySection title={t('kitGallery.sectionProfile')} hint={t('kitGallery.profileHint')} testID="gallery-profile">
      <View style={styles.group}>
        <ListGroup title={t('profileEdit.phoneLabel')}>
          <ListItem icon="phone" title="+92 300 0000000" value={t('profileEdit.changeNumber')} onPress={noop} />
        </ListGroup>
        <AppText variant="caption" color="textSecondary" style={styles.helper}>
          {t('profileEdit.phoneHelper')}
        </AppText>
      </View>
      <Banner
        tone="info"
        title={t('kitGallery.profilePendingEmailTitle')}
        text={t('kitGallery.profilePendingEmailBody', { email: 'sample.rider@example-mail.com.pk' })}
        actionPlacement="below"
        action={{ label: t('kitGallery.profileCancelChange'), onPress: noop }}
      />
      <ProfileInfoList user={SAMPLE} />
      <Button label={t('profileEdit.save')} onPress={noop} disabled />
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  helper: { marginHorizontal: space[4] },
});
