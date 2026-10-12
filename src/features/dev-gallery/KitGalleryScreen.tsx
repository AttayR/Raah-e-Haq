import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText, IconButton, Screen } from '../../components/ui';
import { t } from '../../i18n';
import { layout, space } from '../../theme';
import { COLOR_PART_COUNT, ColorSection } from './sections/ColorSection';
import { FormatSection, HapticsSection } from './sections/FormatSection';
import { ICON_PART_COUNT, IconSection } from './sections/IconSection';
import { KitSection } from './sections/KitSection';
import { ComponentTokenSection, ElevationSection, RadiusSection, SpacingSection } from './sections/ScaleSections';
import { TYPE_PART_COUNT, TypeSection } from './sections/TypeSection';

/** Section keys, in display order. Numbered keys (`colors1`, `type2`, …) are parts sized for one SE screen. */
type Section = [string, () => React.ReactElement];

const parts = (prefix: string, count: number, render: (i: number) => React.ReactElement): Section[] =>
  Array.from({ length: count }, (_, i): Section => [`${prefix}${i + 1}`, () => render(i)]);

const SECTIONS: Section[] = [
  ...parts('colors', COLOR_PART_COUNT, i => <ColorSection part={i} />),
  ...parts('type', TYPE_PART_COUNT, i => <TypeSection part={i} />),
  ...parts('icons', ICON_PART_COUNT, i => <IconSection part={i} />),
  ['format', () => <FormatSection />],
  ['kit1', () => <KitSection part="controls" />],
  ['kit2', () => <KitSection part="lists" />],
  ['spacing', () => <SpacingSection />],
  ['radius', () => <RadiusSection />],
  ['elevation', () => <ElevationSection />],
  ['components1', () => <ComponentTokenSection groups={['button', 'iconButton']} />],
  ['components2', () => <ComponentTokenSection groups={['header', 'tabBar']} />],
  ['haptics', () => <HapticsSection />],
];

export const GALLERY_SECTION_KEYS = SECTIONS.map(([key]) => key);

type Props = {
  onClose: () => void;
  /** Comma-separated section keys to show alone (scripted screenshots); all when omitted. */
  only?: string;
};

/**
 * Debug-only kit gallery (UI-R1, DESIGN_SYSTEM v1.1): every colour token with its contrast
 * pair, every text style, the spacing/radius/elevation scales, v1.1 component tokens, every
 * icon, the formatters, the haptic patterns and the kit components. Opened from the React
 * Native dev menu ("Open UI kit gallery") through `DevKitGalleryHost`; never reachable in a
 * release build.
 */
export function KitGalleryScreen({ onClose, only }: Props) {
  const { theme } = useAppTheme();
  const wanted = only ? only.split(',').map(k => k.trim()) : null;
  const shown = wanted ? SECTIONS.filter(([key]) => wanted.includes(key)) : SECTIONS;
  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={styles.content} testID="kit-gallery">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="h1" accessibilityRole="header">
            {t('kitGallery.title')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('kitGallery.subtitle')}
          </AppText>
          <AppText variant="label" color="primaryText" testID="kit-gallery-mode">
            {t('kitGallery.modeLabel', { mode: theme.mode })}
          </AppText>
        </View>
        <IconButton
          icon="close"
          variant="tonal"
          onPress={onClose}
          accessibilityLabel={t('kitGallery.closeA11y')}
          testID="kit-gallery-close"
        />
      </View>
      {shown.map(([key, render]) => (
        <React.Fragment key={key}>{render()}</React.Fragment>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: space[8] },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingTop: space[4] },
  headerText: { flex: 1, gap: space[1] },
});
