import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Card,
  IconButton,
  ListGroup,
  ListItem,
  SegmentedControl,
  type ButtonVariant,
} from '../../../components/ui';
import { Chip } from '../../../components/ui/Chip';
import { t, type TranslationKey } from '../../../i18n';
import { space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

const VARIANTS: Array<[ButtonVariant, TranslationKey]> = [
  ['primary', 'kitGallery.buttonPrimary'],
  ['secondary', 'kitGallery.buttonSecondary'],
  ['outline', 'kitGallery.buttonOutline'],
  ['ghost', 'kitGallery.buttonGhost'],
  ['destructive', 'kitGallery.buttonDestructive'],
];

/**
 * The kit components that exist today, in their states. UI-R2/R3/R5 add their components here
 * as they land.
 */
export function KitSection({ part }: { part?: 'controls' | 'lists' }) {
  const [segment, setSegment] = useState<'a' | 'b'>('a');
  const showControls = part !== 'lists';
  const showLists = part !== 'controls';
  return (
    <GallerySection title={t('kitGallery.sectionKit')}>
      {showControls ? (
        <>
          {VARIANTS.map(([variant, key]) => (
            <Button
              key={variant}
              label={t(key)}
              variant={variant}
              onPress={noop}
              testID={`gallery-button-${variant}`}
            />
          ))}
          <View style={styles.row}>
            <Button
              label={t('kitGallery.buttonLoading')}
              loading
              onPress={noop}
              fullWidth={false}
              size="sm"
            />
            <Button
              label={t('kitGallery.buttonDisabled')}
              disabled
              onPress={noop}
              fullWidth={false}
              size="sm"
            />
            <IconButton
              icon="locate"
              variant="floating"
              onPress={noop}
              accessibilityLabel={t('kitGallery.locateA11y')}
            />
            <IconButton
              icon="close"
              variant="tonal"
              onPress={noop}
              accessibilityLabel={t('common.close')}
            />
          </View>
          <View style={styles.row}>
            <Badge label="success" tone="success" />
            <Badge label="warning" tone="warning" />
            <Badge label="danger" tone="danger" />
            <Badge label="info" tone="info" />
            <Badge label="neutral" />
          </View>
          <View style={styles.row}>
            <Chip label="home" icon="home" selected onPress={noop} />
            <Chip label="work" icon="work" onPress={noop} />
            <Avatar name="Raah Haq" size={40} />
            <Avatar name="Raah Haq" size={48} online />
          </View>
          <SegmentedControl
            options={[
              { value: 'a', label: t('kitGallery.buttonPrimary') },
              { value: 'b', label: t('kitGallery.buttonSecondary') },
            ]}
            value={segment}
            onChange={setSegment}
            accessibilityLabel={t('kitGallery.sectionKit')}
          />
        </>
      ) : null}
      {showLists ? (
        <>
          <ListGroup title={t('kitGallery.sectionKit')}>
            <ListItem
              title="ListItem"
              subtitle="subtitle"
              icon="wallet"
              onPress={noop}
            />
            <ListItem
              title="ListItem"
              icon="logout"
              destructive
              onPress={noop}
            />
          </ListGroup>
          <Card>
            <ListItem title="Card" subtitle="elevated" icon="cash" />
          </Card>
        </>
      ) : null}
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
});
