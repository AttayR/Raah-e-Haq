import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  Card,
  Checkbox,
  Chip,
  Icon,
  Skeleton,
  SkeletonGroup,
  type IconName,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import type { DeletionBlocker } from '../api';
import { blockerView, type BlockerAction, type ConsequenceLine } from '../format';

const k = componentTokens.accountDeletion;

/** §D1.1: the 64 `dangerSoft` disc with the `accountRemove` glyph, title and the dated paragraph. */
export function DeletionHero({ title, body }: { title: string; body?: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.hero} testID="delete-account-hero">
      <View style={[styles.disc, { backgroundColor: theme.colors.dangerSoft }]}>
        <Icon name="accountRemove" size={k.discGlyph} color="danger" />
      </View>
      <AppText variant="h2" accessibilityRole="header" style={styles.heroTitle}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color="textSecondary" style={styles.heroBody} testID="delete-account-hero-body">
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

/** §D1.2: one Banner per blocker (8 apart), the action below the text. */
export function BlockerBanners({
  blockers,
  onAction,
}: {
  blockers: ReadonlyArray<DeletionBlocker>;
  onAction: (action: BlockerAction, blocker: DeletionBlocker) => void;
}) {
  if (blockers.length === 0) return null;
  return (
    <View style={styles.blockers} testID="delete-account-blockers">
      {blockers.map((blocker, index) => {
        const view = blockerView(blocker);
        const action = view.action;
        const id = `delete-account-blocker-${blocker.code.toLowerCase()}`;
        return (
          <Banner
            key={`${blocker.code}-${index}`}
            tone={view.tone}
            text={view.text}
            actionPlacement="below"
            action={
              action ? { label: action.label, onPress: () => onAction(action.kind, blocker), testID: `${id}-action` } : undefined
            }
            testID={id}
          />
        );
      })}
    </View>
  );
}

/** §D1.3–4: overline, then a Card with one row per line (leading 20 glyph, `body`). */
export function ConsequenceList({
  overline,
  icon,
  lines,
  helper,
  testID,
}: {
  overline: string;
  icon: IconName;
  lines: ReadonlyArray<ConsequenceLine>;
  helper?: string;
  testID: string;
}) {
  const { theme } = useAppTheme();
  if (lines.length === 0) return null;
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="overline" color="textSecondary" accessibilityRole="header">
        {overline}
      </AppText>
      <Card variant="outlined" padding="none">
        {lines.map((line, index) => (
          <View
            key={line.key}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: theme.borderWidth.hairline, borderTopColor: theme.colors.border },
            ]}
            testID={`${testID}-${line.key}`}
          >
            <Icon name={icon} size={k.rowGlyph} color="textSecondary" />
            <AppText variant="body" style={styles.rowText}>
              {line.text}
            </AppText>
          </View>
        ))}
      </Card>
      {helper ? (
        <AppText variant="caption" color="textSecondary" testID={`${testID}-helper`}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}

/** Loading (§D1 states): 3 skeleton rows for each list. */
export function ConsequenceSkeleton() {
  return (
    <SkeletonGroup testID="delete-account-loading" accessibilityLabel={t('accountDeletion.loadingA11y')} style={styles.loading}>
      {[0, 1].map((group) => (
        <View key={group} style={styles.section}>
          <Skeleton width="40%" textVariant="overline" />
          <Skeleton shape="card" height={k.rowMinHeight * 3} style={styles.skeletonCard} />
        </View>
      ))}
    </SkeletonGroup>
  );
}

/** §D1.5: the forfeited balance and its acknowledgement (sent as `acknowledge_balance: true`). */
export function BalanceAcknowledge({
  amount,
  checked,
  onChange,
}: {
  amount: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <View style={styles.section} testID="delete-account-balance">
      <Banner tone="warning" text={t('accountDeletion.balanceWarning', { amount })} testID="delete-account-balance-warning" />
      <Checkbox
        checked={checked}
        onChange={onChange}
        label={t('accountDeletion.balanceAck')}
        testID="delete-account-balance-ack"
      />
    </View>
  );
}

/**
 * Where the reason row should scroll so the chip at `x`..`x + width` shows whole with a gutter
 * of room (a selected chip grows by its check glyph and may pass the screen edge), or null when
 * it already does.
 */
export const chipRevealX = (
  x: number,
  width: number,
  scrollX: number,
  viewport: number,
  content: number,
): number | null => {
  const max = Math.max(0, content - viewport);
  if (x + width + layout.gutter > scrollX + viewport) return Math.min(max, x + width + layout.gutter - viewport);
  if (x - layout.gutter < scrollX) return Math.max(0, x - layout.gutter);
  return null;
};

/** §D1.7: optional single-select reason chips, horizontally scrolling; a second tap clears. */
export function ReasonChips({
  options,
  selected,
  onSelect,
}: {
  options: ReadonlyArray<{ slug: string; label: string }>;
  selected: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const sizes = useRef({ viewport: 0, content: 0 });
  // The chip just selected: scrolled into view once its new (wider) layout is known.
  const reveal = useRef<string | null>(null);

  const onChipLayout = useCallback((slug: string, e: LayoutChangeEvent) => {
    if (reveal.current !== slug) return;
    const { x, width } = e.nativeEvent.layout;
    const target = chipRevealX(x, width, scrollX.current, sizes.current.viewport, Math.max(sizes.current.content, x + width + layout.gutter));
    if (target !== null) scrollRef.current?.scrollTo({ x: target, animated: true });
    reveal.current = null;
  }, []);

  if (options.length === 0) return null;
  return (
    <View style={styles.section} testID="delete-account-reasons">
      <AppText variant="overline" color="textSecondary" accessibilityRole="header">
        {t('accountDeletion.reasonOverline')}
      </AppText>
      {/* Bleeds to the screen edges with a gutter inset (like TopicChips): chips slide under the edge, never cut at the gutter. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsBleed}
        contentContainerStyle={styles.chips}
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        onLayout={(e: LayoutChangeEvent) => {
          sizes.current.viewport = e.nativeEvent.layout.width;
        }}
        onContentSizeChange={(width: number) => {
          sizes.current.content = width;
        }}
        testID="delete-account-reasons-row"
      >
        {options.map((option) => (
          <View key={option.slug} onLayout={(e) => onChipLayout(option.slug, e)} testID={`delete-account-reason-${option.slug}-wrap`}>
            <Chip
              label={option.label}
              selected={selected === option.slug}
              onPress={() => {
                const next = selected === option.slug ? null : option.slug;
                reveal.current = next;
                onSelect(next);
              }}
              testID={`delete-account-reason-${option.slug}`}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'flex-start' },
  disc: {
    width: k.disc,
    height: k.disc,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { marginTop: space[4] },
  heroBody: { marginTop: space[2] },
  blockers: { gap: space[2] },
  section: { gap: space[2] },
  row: {
    minHeight: k.rowMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  rowText: { flex: 1 },
  loading: { gap: space[6] },
  skeletonCard: { borderRadius: radius.lg },
  chipsBleed: { marginHorizontal: -layout.gutter },
  chips: { gap: space[2], paddingHorizontal: layout.gutter },
});
