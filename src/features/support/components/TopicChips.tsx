import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Chip } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { topicLabel } from '../format';
import type { SupportCategory } from '../types';

type Props = {
  topics: SupportCategory[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

/** Where the row should start so `chip` shows: its start at the inset, clamped to the row's end. */
export const chipScrollX = (chipX: number, contentWidth: number, viewportWidth: number): number =>
  Math.max(0, Math.min(chipX - layout.gutter, contentWidth - viewportWidth));

/**
 * The topic row of New request (§H4.1, DESIGN_SYSTEM §5.11): one line of single-select chips that
 * bleeds to the screen edges with a 16 content inset, so chips slide under the edge instead of
 * being cut at the gutter. A chip preselected by the opener is scrolled into view once, on first
 * layout, without animation.
 */
export function TopicChips({ topics, selected, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const chipX = useRef<Record<string, number>>({});
  const sizes = useRef({ content: 0, viewport: 0 });
  const initial = useRef(selected);
  const done = useRef(selected === null);

  const tryScroll = useCallback(() => {
    if (done.current || initial.current === null) return;
    const x = chipX.current[initial.current];
    const { content, viewport } = sizes.current;
    if (x === undefined || content === 0 || viewport === 0) return;
    done.current = true;
    scrollRef.current?.scrollTo({ x: chipScrollX(x, content, viewport), animated: false });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bleed}
      contentContainerStyle={styles.chips}
      onLayout={(e: LayoutChangeEvent) => {
        sizes.current.viewport = e.nativeEvent.layout.width;
        tryScroll();
      }}
      onContentSizeChange={(width: number) => {
        sizes.current.content = width;
        tryScroll();
      }}
      testID="support-new-topics"
    >
      {topics.map((topic) => (
        <View
          key={topic.slug}
          onLayout={(e: LayoutChangeEvent) => {
            chipX.current[topic.slug] = e.nativeEvent.layout.x;
            if (topic.slug === initial.current) tryScroll();
          }}
        >
          <Chip
            label={topicLabel(topic)}
            selected={selected === topic.slug}
            accessibilityRole="radio"
            onPress={() => onSelect(topic.slug)}
            testID={`support-new-topic-${topic.slug}`}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -layout.gutter },
  chips: { gap: space[2], paddingHorizontal: layout.gutter },
});
