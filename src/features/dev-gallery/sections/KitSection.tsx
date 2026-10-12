import React from 'react';
import { Card, ListGroup, ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { GallerySection } from './GallerySection';

const noop = () => {};

/**
 * List components in their current (pre-UI-R3) form. The controls moved to their own UI-R2
 * sections (ButtonSection, FieldSection, SelectionSection, BadgeSection); UI-R3 restyles these.
 */
export function KitSection() {
  return (
    <GallerySection title={t('kitGallery.sectionKit')}>
      <ListGroup title={t('kitGallery.sectionKit')}>
        <ListItem
          title="ListItem"
          subtitle="subtitle"
          icon="wallet"
          onPress={noop}
        />
        <ListItem title="ListItem" icon="logout" destructive onPress={noop} />
      </ListGroup>
      <Card>
        <ListItem title="Card" subtitle="elevated" icon="cash" />
      </Card>
    </GallerySection>
  );
}
