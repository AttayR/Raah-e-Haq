import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { t } from '../../../i18n';
import {
  componentTokens,
  radius,
  space,
  type ElevationLevel,
  type RadiusToken,
  type SpaceToken,
} from '../../../theme';
import { GallerySection } from './GallerySection';

const SPACE_KEYS = (Object.keys(space) as unknown as SpaceToken[]).filter(k => space[k] > 0);
const RADIUS_KEYS = Object.keys(radius) as RadiusToken[];
const ELEVATION_LEVELS: ElevationLevel[] = [0, 1, 2, 3, 4];

/** §3.1 spacing scale as bars. */
export function SpacingSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionSpacing')}>
      {SPACE_KEYS.map(k => (
        <View key={k} style={styles.scaleRow} testID={`gallery-space-${k}`}>
          <AppText variant="caption" color="textSecondary" style={styles.scaleLabel}>
            {`space[${k}] ${space[k]}`}
          </AppText>
          <View style={[styles.bar, { width: space[k], backgroundColor: theme.colors.primary }]} />
        </View>
      ))}
    </GallerySection>
  );
}

/** §3.3 radii, including the v1.1 pill used by every button. */
export function RadiusSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionRadius')}>
      <View style={styles.wrap}>
        {RADIUS_KEYS.map(k => (
          <View key={k} style={styles.tileCell} testID={`gallery-radius-${k}`}>
            <View
              style={[
                styles.tile,
                { borderRadius: radius[k], backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
              ]}
            />
            <AppText variant="caption" color="textSecondary">{`${k} ${radius[k]}`}</AppText>
          </View>
        ))}
      </View>
    </GallerySection>
  );
}

/** §3.5 elevation levels; dark mode shows the outline instead of a shadow. */
export function ElevationSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionElevation')}>
      <View style={styles.wrap}>
        {ELEVATION_LEVELS.map(level => (
          <View key={level} style={styles.tileCell} testID={`gallery-elevation-${level}`}>
            <View
              style={[
                styles.tile,
                theme.elevation[level],
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.mode === 'dark' ? theme.colors.border : theme.colors.surface,
                },
              ]}
            />
            <AppText variant="caption" color="textSecondary">{`elevation.${level}`}</AppText>
          </View>
        ))}
      </View>
    </GallerySection>
  );
}

const flatten = (prefix: string, value: unknown): string[] =>
  value !== null && typeof value === 'object'
    ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => flatten(`${prefix}.${k}`, v))
    : [`${prefix} = ${String(value)}`];

/** v1.1 component tokens (button radius, header, tab bar, IconButton) as key = value lines; `groups` filters. */
export function ComponentTokenSection({ groups }: { groups?: ReadonlyArray<keyof typeof componentTokens> }) {
  const lines = Object.entries(componentTokens)
    .filter(([k]) => !groups || groups.includes(k as keyof typeof componentTokens))
    .flatMap(([k, v]) => flatten(k, v));
  return (
    <GallerySection title={t('kitGallery.sectionComponents')}>
      {lines.map(line => (
        <AppText key={line} variant="caption" color="textSecondary">
          {line}
        </AppText>
      ))}
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  scaleLabel: { width: space[16] + space[8] },
  bar: { height: space[3], borderRadius: radius.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  tileCell: { alignItems: 'center', gap: space[1] },
  tile: { width: space[16], height: space[12], borderWidth: 1 },
});
