import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button } from '../../../components/ui';
import { haptics, HAPTIC_PATTERNS } from '../../../core/haptics';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import {
  formatDistance,
  formatDuration,
  formatMoney,
  formatRelativeDate,
  formatSignedMoney,
  formatTime,
} from '../../../utils/format';
import { GallerySection } from './GallerySection';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Formatter inputs and outputs. Gallery-only examples of the format, not screen data. */
const examples = (now: Date): Array<[string, string]> => [
  ['formatMoney(1200)', formatMoney(1200)],
  ['formatMoney(1250, "PKR")', formatMoney(1250, 'PKR')],
  ['formatMoney("412.5")', formatMoney('412.5')],
  ['formatMoney(null)', formatMoney(null)],
  ['formatSignedMoney(500)', formatSignedMoney(500)],
  ['formatSignedMoney(-50)', formatSignedMoney(-50)],
  ['formatDistance(3.42)', formatDistance(3.42)],
  ['formatDistance(0.04)', formatDistance(0.04)],
  ['formatDistance(12.6)', formatDistance(12.6)],
  ['formatDuration(7)', formatDuration(7)],
  ['formatDuration(65)', formatDuration(65)],
  ['formatRelativeDate(now)', formatRelativeDate(now, now)],
  ['formatRelativeDate(now - 1 day)', formatRelativeDate(new Date(now.getTime() - DAY_MS), now)],
  ['formatRelativeDate(now - 9 days)', formatRelativeDate(new Date(now.getTime() - 9 * DAY_MS), now)],
  ['formatTime(now)', formatTime(now)],
];

export function FormatSection() {
  const rows = examples(new Date());
  return (
    <GallerySection title={t('kitGallery.sectionFormat')}>
      {rows.map(([input, output]) => (
        <View key={input} style={styles.row}>
          <AppText variant="caption" color="textSecondary" style={styles.input} numberOfLines={1}>
            {input}
          </AppText>
          <AppText variant="numeric" testID={`gallery-format-${input}`}>
            {output === '' ? '""' : output}
          </AppText>
        </View>
      ))}
    </GallerySection>
  );
}

/** One small button per §6.11 haptic pattern. */
export function HapticsSection() {
  return (
    <GallerySection title={t('kitGallery.sectionHaptics')} hint={t('kitGallery.hapticsHint')}>
      <View style={styles.wrap}>
        {HAPTIC_PATTERNS.map(pattern => (
          <Button
            key={pattern}
            label={pattern}
            size="sm"
            variant="secondary"
            fullWidth={false}
            onPress={haptics[pattern]}
            testID={`gallery-haptic-${pattern}`}
          />
        ))}
      </View>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  input: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
