import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui';
import { t } from '../../../i18n';
import { space, textStyles, type TextStyleName } from '../../../theme';
import { GallerySection } from './GallerySection';

const STYLE_NAMES = Object.keys(textStyles) as TextStyleName[];

/** Styles per part, so each part fits one iPhone SE screenshot. */
const TYPE_PART_SIZE = 7;
export const TYPE_PART_COUNT = Math.ceil(STYLE_NAMES.length / TYPE_PART_SIZE);

/** Text styles from §2 with size / line height / weight; `part` renders one slice. */
export function TypeSection({ part }: { part?: number }) {
  const names =
    part === undefined ? STYLE_NAMES : STYLE_NAMES.slice(part * TYPE_PART_SIZE, (part + 1) * TYPE_PART_SIZE);
  const title =
    part === undefined
      ? t('kitGallery.sectionType')
      : t('kitGallery.sectionTypePart', { part: part + 1, count: TYPE_PART_COUNT });
  return (
    <GallerySection title={title}>
      {names.map(name => {
        const s = textStyles[name];
        return (
          <View key={name} style={styles.row} testID={`gallery-type-${name}`}>
            <AppText variant="caption" color="textMuted">
              {`${name} · ${s.fontSize}/${s.lineHeight} · ${s.fontWeight}`}
            </AppText>
            <AppText variant={name} numberOfLines={name === 'display' ? 2 : 1}>
              {t('kitGallery.sampleText')}
            </AppText>
          </View>
        );
      })}
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[1] },
});
