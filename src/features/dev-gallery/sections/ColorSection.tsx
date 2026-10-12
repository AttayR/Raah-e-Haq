import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { t } from '../../../i18n';
import { contrastRatio, radius, space, type SemanticColors } from '../../../theme';
import { CONTRAST_PAIRS, thresholdFor, type ContrastPair } from '../contrastPairs';
import { GallerySection } from './GallerySection';

const describe = (pair: ContrastPair, colors: SemanticColors): { ratio: string; ok: boolean | null } => {
  const threshold = thresholdFor(pair.kind);
  if (pair.kind === 'scrim') {
    return { ratio: pair.kind, ok: null };
  }
  const value = contrastRatio(colors[pair.fg], colors[pair.bg]);
  return { ratio: value.toFixed(2), ok: threshold === null ? null : value >= threshold };
};

function ColorRow({ pair }: { pair: ContrastPair }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const { ratio, ok } = describe(pair, colors);
  const verdict = ok === null ? pair.kind : ok ? t('kitGallery.pass') : t('kitGallery.fail');
  const label = `${pair.token} ${colors[pair.token]}, ${pair.fg} ${t('kitGallery.contrastOn', {
    background: pair.bg,
  })} ${ratio}, ${verdict}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={label} testID={`gallery-color-${pair.token}`}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: colors[pair.bg], borderColor: theme.colors.border },
        ]}
      >
        <AppText variant="label" style={{ color: colors[pair.fg] }}>
          {t('kitGallery.swatchSample')}
        </AppText>
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {pair.token}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {`${colors[pair.token]} · ${pair.fg} ${t('kitGallery.contrastOn', { background: pair.bg })}`}
        </AppText>
      </View>
      <View style={styles.ratio}>
        <AppText variant="numeric">{ratio}</AppText>
        <AppText variant="caption" color={ok === false ? 'danger' : ok ? 'success' : 'textMuted'}>
          {verdict}
        </AppText>
      </View>
    </View>
  );
}

/** Rows per part, so each part fits one iPhone SE screenshot. */
export const COLOR_PART_SIZE = 6;
export const COLOR_PART_COUNT = Math.ceil(CONTRAST_PAIRS.length / COLOR_PART_SIZE);

/**
 * Semantic colour tokens with their §1.5 contrast pairs, computed live from the theme. `part`
 * (0-based) renders one slice of COLOR_PART_SIZE rows; omitted, it renders every token.
 */
export function ColorSection({ part }: { part?: number }) {
  const pairs =
    part === undefined ? CONTRAST_PAIRS : CONTRAST_PAIRS.slice(part * COLOR_PART_SIZE, (part + 1) * COLOR_PART_SIZE);
  const title =
    part === undefined
      ? t('kitGallery.sectionColors')
      : t('kitGallery.sectionColorsPart', { part: part + 1, count: COLOR_PART_COUNT });
  return (
    <GallerySection title={title} hint={t('kitGallery.sectionColorsHint')}>
      {pairs.map(pair => (
        <ColorRow key={pair.token} pair={pair} />
      ))}
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  swatch: {
    width: space[12],
    height: space[12],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  ratio: { alignItems: 'flex-end' },
});
