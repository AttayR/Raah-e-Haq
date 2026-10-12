import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Icon, iconGlyphs, type IconName } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { GallerySection } from './GallerySection';

const ICON_NAMES = Object.keys(iconGlyphs) as IconName[];

/** Icons per part, so each part fits one iPhone SE screenshot. */
const ICON_PART_SIZE = 28;
export const ICON_PART_COUNT = Math.ceil(ICON_NAMES.length / ICON_PART_SIZE);

/**
 * Semantic icon names with their MDI glyphs; a missing font shows "?" boxes here. `part`
 * (0-based) renders one slice; omitted, every icon.
 */
export function IconSection({ part }: { part?: number }) {
  const names =
    part === undefined ? ICON_NAMES : ICON_NAMES.slice(part * ICON_PART_SIZE, (part + 1) * ICON_PART_SIZE);
  const title =
    part === undefined
      ? t('kitGallery.sectionIcons')
      : t('kitGallery.sectionIconsPart', { part: part + 1, count: ICON_PART_COUNT });
  return (
    <GallerySection title={title}>
      <View style={styles.grid}>
        {names.map(name => (
          <View key={name} style={styles.cell} testID={`gallery-icon-${name}`}>
            <Icon name={name} size={24} color="textPrimary" />
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {name}
            </AppText>
          </View>
        ))}
      </View>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[3] },
  cell: { width: '25%', alignItems: 'center', gap: space[1], paddingHorizontal: space[1] },
});
