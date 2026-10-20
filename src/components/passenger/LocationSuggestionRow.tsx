import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from '../ui/AppText';
import { Icon, type IconName } from '../ui/Icon';
import { componentTokens, radius, space, textStyles } from '../../theme';

/** A matched part of the title (Places `main_text_matched_substrings`). */
export type MatchedRange = { offset: number; length: number };

/**
 * The title split into plain and matched parts (in order, never overlapping, inside the text).
 * Unusable ranges are dropped, so a bad answer never hides or repeats text.
 */
export const titleParts = (title: string, matched: ReadonlyArray<MatchedRange> | undefined): { text: string; strong: boolean }[] => {
  const ranges = (matched ?? [])
    .filter((m) => Number.isInteger(m.offset) && Number.isInteger(m.length) && m.offset >= 0 && m.length > 0)
    .map((m) => ({ start: m.offset, end: Math.min(title.length, m.offset + m.length) }))
    .filter((m) => m.start < m.end)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; strong: boolean }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at) continue;
    if (r.start > at) parts.push({ text: title.slice(at, r.start), strong: false });
    parts.push({ text: title.slice(r.start, r.end), strong: true });
    at = r.end;
  }
  if (at < title.length) parts.push({ text: title.slice(at), strong: false });
  return parts.length > 0 ? parts : [{ text: title, strong: false }];
};

const k = componentTokens.listItem;
/** Text start inside the row: the 40 tile and 16 (the kit ListItem rhythm); the divider starts here. */
export const SUGGESTION_TEXT_START = k.tile + space[4];

type TileProps = { icon: IconName; tone?: 'neutral' | 'primary'; testID?: string };

/** The kit's 40 leading tile (radius `md`, §5.8) with a 20 glyph. */
export function SuggestionTile({ icon, tone = 'neutral', testID }: TileProps) {
  const { theme } = useAppTheme();
  return (
    <View testID={testID} style={[styles.tile, { backgroundColor: tone === 'primary' ? theme.colors.primarySoft : theme.colors.surfaceAlt }]}>
      <Icon name={icon} size={20} color={tone === 'primary' ? 'primaryText' : 'textSecondary'} />
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle: string;
  matched?: ReadonlyArray<MatchedRange>;
  /** Place Details is loading for this row: a 20 spinner trailing. */
  selecting?: boolean;
  /** A hairline under the row, from the text start. */
  divider?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * One Places suggestion (passenger-destination-search block 4; UI-R9b): min 64, the kit tile with
 * `map-marker-outline`, the title in `title` with the typed match in 700, the rest of the address
 * in `bodySmall` `textSecondary` (1 line each), divider at the text start (inset to the tile's
 * text like the saved and recent rows).
 */
export function LocationSuggestionRow({ title, subtitle, matched, selecting = false, divider = false, onPress, accessibilityLabel, testID }: RowProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.row, pressed ? { backgroundColor: c.surfacePressed } : null]}
      onPress={onPress}
    >
      <SuggestionTile icon="pinOutline" testID={testID ? `tile-${testID}` : undefined} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1}>
          {titleParts(title, matched).map((part, i) =>
            part.strong ? (
              <Text key={i} style={styles.strong}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      {selecting ? <ActivityIndicator size="small" color={c.primaryText} /> : null}
      {divider ? (
        <View
          style={[styles.divider, { backgroundColor: c.border, height: theme.borderWidth.hairline }]}
          testID={testID ? `divider-${testID}` : undefined}
        />
      ) : null}
    </Pressable>
  );
}

export const suggestionRowStyles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: space[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  tile: { width: k.tile, height: k.tile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  row: suggestionRowStyles.row,
  tile: suggestionRowStyles.tile,
  text: { flex: 1, minWidth: 0 },
  strong: { fontWeight: textStyles.h1.fontWeight },
  divider: { position: 'absolute', bottom: 0, start: SUGGESTION_TEXT_START, end: 0 },
});
