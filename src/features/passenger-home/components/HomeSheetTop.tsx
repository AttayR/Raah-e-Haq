import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { headerKindFor, type HomeHeaderKind, type TaglineSlot } from '../layout';
import { WhereToBar } from './WhereToBar';

type AnimatedStyle = StyleProp<ViewStyle>;

type Props = {
  /** "Good evening, Attay" (V3; the salutation alone without a name). */
  greeting: string;
  /** What shows under the greeting (V3): the tagline, the offline line, or nothing. */
  slot: TaglineSlot;
  /** A ride or parcel is in progress: greeting only; "Return" sits in the body instead of "Where to?". */
  live: boolean;
  onWhereTo: () => void;
  /** The header's natural height whenever it changes by 1pt or more (drives the peek, V1). */
  onHeight: (height: number, kind: HomeHeaderKind) => void;
  /** Cold-open entrance (V7): the greeting block's and "Where to?"'s animated styles. */
  greetingStyle?: AnimatedStyle;
  whereToStyle?: AnimatedStyle;
};

/**
 * The pinned Home sheet header (UI-R20b, passenger-home V1, V3, V4): the time-of-day greeting in
 * `title` (a header for screen readers), the tagline slot in `bodySmall` ("Fixed fares, within the
 * city", or the offline line in `warning` with its glyph), then 12 and the "Where to?" hero and
 * 12. While a ride is live it is the greeting and 12 only. Memoised on strings and booleans, so
 * sheet drags, camera moves and nearby polls never re-render it.
 */
function HomeSheetTopBase({ greeting, slot, live, onWhereTo, onHeight, greetingStyle, whereToStyle }: Props) {
  const kind = headerKindFor(live, slot);
  const last = useRef<{ kind: HomeHeaderKind; height: number } | null>(null);
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      const prev = last.current;
      if (prev && prev.kind === kind && Math.abs(prev.height - height) < 1) return;
      last.current = { kind, height };
      onHeight(height, kind);
    },
    [kind, onHeight],
  );

  return (
    <View style={styles.header} onLayout={onLayout} testID="home-sheet-top">
      <Animated.View style={greetingStyle}>
        <AppText variant="title" numberOfLines={1} accessibilityRole="header" testID="home-greeting">
          {greeting}
        </AppText>
        {slot === 'tagline' ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} testID="home-tagline">
            {t('home.tagline')}
          </AppText>
        ) : slot === 'offline' ? (
          <View style={styles.offline} accessible accessibilityLabel={t('home.offlineTagline')} testID="home-offline-tagline">
            <Icon name="offline" size={componentTokens.home.taglineGlyph} color="warning" />
            <AppText variant="bodySmall" color="warning" numberOfLines={1} style={styles.offlineText}>
              {t('home.offlineTagline')}
            </AppText>
          </View>
        ) : null}
      </Animated.View>
      {live ? null : (
        <Animated.View style={[styles.whereTo, whereToStyle]}>
          <WhereToBar onPress={onWhereTo} />
        </Animated.View>
      )}
    </View>
  );
}

export const HomeSheetTop = memo(HomeSheetTopBase);

const styles = StyleSheet.create({
  header: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  whereTo: { marginTop: space[3] },
  offline: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  offlineText: { flexShrink: 1 },
});
