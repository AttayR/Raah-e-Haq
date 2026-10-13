import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Avatar,
  Badge,
  Card,
  Header,
  ListGroup,
  ListItem,
  Switch,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

/** Header variants (§5.2 v1.1): standard with back + actions, text action, large, overlay. */
export function HeaderSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionHeaders')}>
      <View style={[styles.frame, { borderColor: theme.colors.border }]}>
        <Header
          title={t('kitGallery.headerStandard')}
          onBack={noop}
          actions={[
            { icon: 'chat', onPress: noop, accessibilityLabel: t('kitGallery.headerShare') },
            { icon: 'more', onPress: noop, accessibilityLabel: t('kitGallery.headerMore') },
          ]}
          testID="gallery-header-standard"
        />
      </View>
      <View style={[styles.frame, { borderColor: theme.colors.border }]}>
        <Header
          title={t('kitGallery.headerStandard')}
          onBack={noop}
          trailingText={{ label: t('kitGallery.headerMarkAllRead'), onPress: noop }}
        />
      </View>
      <View style={[styles.frame, { borderColor: theme.colors.border }]}>
        <Header
          variant="large"
          title={t('kitGallery.headerLarge')}
          tone="background"
          trailingText={{ label: t('kitGallery.headerMarkAllRead'), onPress: noop }}
        />
      </View>
      <View style={[styles.map, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}>
        {/* On a map the overlay sits at insets.top + 8; in this frame it is 8 from the top. */}
        <Header
          variant="overlay"
          overlayTop={space[2]}
          onBack={noop}
          actions={[{ icon: 'more', onPress: noop, accessibilityLabel: t('kitGallery.headerMore') }]}
        />
        <AppText variant="caption" color="textSecondary" style={styles.mapHint}>
          {t('kitGallery.overlayHint')}
        </AppText>
      </View>
    </GallerySection>
  );
}

/** Card variants (§5.7): elevated, outlined, filled, selected, pressable. */
export function CardSection() {
  const [selected, setSelected] = useState(true);
  return (
    <GallerySection title={t('kitGallery.sectionCards')}>
      <Card>
        <AppText variant="bodySmall">{t('kitGallery.cardElevated')}</AppText>
      </Card>
      <Card variant="outlined">
        <AppText variant="bodySmall">{t('kitGallery.cardOutlined')}</AppText>
      </Card>
      <Card variant="filled">
        <AppText variant="bodySmall">{t('kitGallery.cardFilled')}</AppText>
      </Card>
      <Card
        variant={selected ? 'selected' : 'outlined'}
        onPress={() => setSelected(v => !v)}
        accessibilityRole="radio"
        accessibilityLabel={t('kitGallery.cardSelected')}
        testID="gallery-card-selected"
      >
        <AppText variant="bodySmall">{t('kitGallery.cardSelected')}</AppText>
      </Card>
      <Card onPress={noop} accessibilityLabel={t('kitGallery.cardPressable')} testID="gallery-card-pressable">
        <AppText variant="bodySmall">{t('kitGallery.cardPressable')}</AppText>
      </Card>
    </GallerySection>
  );
}

/** ListItem / ListGroup (§5.8, §12.4): settings rows with tiles, content rows, plain icon rows. */
export function ListSection() {
  const [sound, setSound] = useState(true);
  return (
    <GallerySection title={t('kitGallery.sectionLists')}>
      <ListGroup title={t('kitGallery.groupAccount')}>
        <ListItem title={t('kitGallery.rowSavedPlaces')} icon="bookmark" onPress={noop} />
        <ListItem title={t('kitGallery.rowAppearance')} icon="theme" value={t('kitGallery.rowAppearanceValue')} onPress={noop} chevron />
        <ListItem
          title={t('kitGallery.switchLabel')}
          icon="bell"
          onPress={() => setSound(v => !v)}
          trailing={<Switch value={sound} onValueChange={setSound} accessibilityLabel={t('kitGallery.switchLabel')} />}
        />
        <ListItem title={t('kitGallery.rowSignOut')} icon="logout" destructive onPress={noop} />
      </ListGroup>
      <ListGroup title={t('kitGallery.groupContent')}>
        <ListItem
          variant="content"
          title={t('kitGallery.rowRideTitle')}
          subtitle={t('kitGallery.rowRideSubtitle')}
          meta={t('kitGallery.rowRideMeta')}
          icon="rickshaw"
          onPress={noop}
        />
        <ListItem
          variant="content"
          title={t('kitGallery.rowChatName')}
          subtitle={t('kitGallery.rowChatMessage')}
          leading={<Avatar name={t('kitGallery.rowChatName')} size={40} />}
          trailing={<Badge variant="count" count={2} accessibilityLabel={t('kit.unreadCountA11y', { count: 2 })} />}
          onPress={noop}
        />
      </ListGroup>
      <ListGroup inset="icon">
        <ListItem title={t('kitGallery.rowNotifications')} icon="bell" iconStyle="plain" onPress={noop} />
        <ListItem title={t('kitGallery.rowSavedPlaces')} icon="bookmark" iconStyle="plain" onPress={noop} />
      </ListGroup>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  frame: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  map: { height: 112, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  mapHint: { position: 'absolute', bottom: space[2], start: space[4], end: space[4] },
});
