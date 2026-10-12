import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  Avatar,
  Badge,
  Checkbox,
  Chip,
  Radio,
  SegmentedControl,
  Switch,
  type AvatarSize,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/** Switch, Checkbox, Radio, SegmentedControl and Chips (§5.9–5.11) with live state. */
export function SelectionSection() {
  const [sound, setSound] = useState(true);
  const [agree, setAgree] = useState(true);
  const [pay, setPay] = useState<'cash' | 'wallet'>('cash');
  const [segment, setSegment] = useState<'phone' | 'email'>('phone');
  const [chip, setChip] = useState<'home' | 'work' | 'recent'>('home');

  return (
    <GallerySection title={t('kitGallery.sectionSelection')}>
      <View style={styles.row}>
        <Switch
          value={sound}
          onValueChange={setSound}
          accessibilityLabel={t('kitGallery.switchLabel')}
          testID="gallery-switch"
        />
        <Switch
          value={false}
          onValueChange={noop}
          accessibilityLabel={t('kitGallery.switchLabel')}
        />
        <Switch
          value
          disabled
          onValueChange={noop}
          accessibilityLabel={t('kitGallery.buttonDisabled')}
        />
        <AppText variant="bodySmall" color="textSecondary">
          {t('kitGallery.switchLabel')}
        </AppText>
      </View>
      <Checkbox
        label={t('kitGallery.checkboxLabel')}
        checked={agree}
        onChange={setAgree}
        testID="gallery-checkbox"
      />
      <Checkbox
        label={t('kitGallery.checkboxLabel')}
        checked={false}
        onChange={noop}
      />
      <Checkbox
        label={t('kitGallery.buttonDisabled')}
        checked
        disabled
        onChange={noop}
      />
      <Radio
        label={t('kitGallery.radioCash')}
        selected={pay === 'cash'}
        onSelect={() => setPay('cash')}
        testID="gallery-radio-cash"
      />
      <Radio
        label={t('kitGallery.radioWallet')}
        selected={pay === 'wallet'}
        onSelect={() => setPay('wallet')}
      />
      <SegmentedControl
        options={[
          { value: 'phone', label: t('kitGallery.segmentPhone') },
          { value: 'email', label: t('kitGallery.segmentEmail') },
        ]}
        value={segment}
        onChange={setSegment}
        accessibilityLabel={t('kitGallery.sectionSelection')}
        testID="gallery-segmented"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={t('kitGallery.chipHome')}
          icon="home"
          selected={chip === 'home'}
          onPress={() => setChip('home')}
        />
        <Chip
          label={t('kitGallery.chipWork')}
          icon="work"
          selected={chip === 'work'}
          onPress={() => setChip('work')}
        />
        <Chip
          label={t('kitGallery.chipRecent')}
          icon="history"
          selected={chip === 'recent'}
          onPress={() => setChip('recent')}
        />
        <Chip label={t('kitGallery.buttonDisabled')} disabled onPress={noop} />
      </ScrollView>
    </GallerySection>
  );
}

const AVATAR_SIZES: AvatarSize[] = [32, 40, 48, 56, 72, 96];

/** Badges (status pill, count, dot) and Avatar fallbacks (§5.12–5.13). */
export function BadgeSection() {
  return (
    <GallerySection title={t('kitGallery.sectionBadges')}>
      <View style={styles.row}>
        <Badge label={t('kitGallery.statusCompleted')} tone="success" />
        <Badge label={t('kitGallery.statusPending')} tone="warning" />
        <Badge label={t('kitGallery.statusCancelled')} tone="danger" />
        <Badge label={t('kitGallery.statusOnTrip')} tone="info" />
        <Badge label={t('kitGallery.statusNoCharge')} />
      </View>
      <View style={styles.row}>
        {/* The host supplies the label ("3 unread"), never the bare number (§5.12). */}
        <Badge
          variant="count"
          count={3}
          accessibilityLabel={t('kit.unreadCountA11y', { count: 3 })}
          testID="gallery-badge-count"
        />
        <Badge
          variant="count"
          count={42}
          accessibilityLabel={t('kit.unreadCountA11y', { count: 42 })}
        />
        <Badge
          variant="count"
          count={150}
          accessibilityLabel={t('kit.unreadCountA11y', { count: 150 })}
        />
        <Badge variant="dot" accessibilityLabel={t('kit.unreadA11y')} />
      </View>
      <View style={styles.row}>
        {AVATAR_SIZES.map(size => (
          <Avatar key={size} name="Ayesha Khan" size={size} />
        ))}
      </View>
      <View style={styles.row}>
        <Avatar name="Bilal Ahmed" size={48} online />
        {/* A photo URL that cannot load falls back to initials, never a blank blob. */}
        <Avatar
          name="Sana Malik"
          uri="file:///nonexistent/avatar.png"
          size={48}
          testID="gallery-avatar-broken"
        />
        <Avatar size={48} />
        <AppText variant="caption" color="textMuted">
          {t('kitGallery.avatarBroken')}
        </AppText>
      </View>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
  },
  chips: { gap: space[2], paddingVertical: space[1] },
});
