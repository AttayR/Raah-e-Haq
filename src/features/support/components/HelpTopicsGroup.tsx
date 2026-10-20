import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, ListGroup, ListItem, Skeleton, SkeletonGroup } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { topicGlyph, topicLabel } from '../format';
import type { SupportCategory } from '../types';

type Props = {
  categories: SupportCategory[] | null;
  loading: boolean;
  onPick: (slug: string | undefined) => void;
};

const SKELETON_ROWS = 4;

/**
 * "Topics" (shared-support-invite §H1.2): one row per topic of GET /support/categories (the
 * server already filters by role), glyph by slug and the label from i18n (the server's name for
 * a slug the app does not know). Loading: four skeleton rows. Failed: one "Write to us" row.
 */
export function HelpTopicsGroup({ categories, loading, onPick }: Props) {
  if (!categories && loading) {
    return (
      <View testID="support-topics-loading">
        <AppText variant="overline" color="textMuted" style={styles.overline}>
          {t('support.topicsOverline')}
        </AppText>
        <SkeletonGroup>
          <View style={styles.skeleton}>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <Skeleton key={i} shape="block" height={componentTokens.listItem.minHeight.one + space[2]} />
            ))}
          </View>
        </SkeletonGroup>
      </View>
    );
  }
  if (!categories || categories.length === 0) {
    return (
      <ListGroup title={t('support.topicsOverline')} testID="support-topics">
        <ListItem icon="chat" title={t('support.writeToUs')} onPress={() => onPick(undefined)} testID="support-write-to-us" />
      </ListGroup>
    );
  }
  return (
    <ListGroup title={t('support.topicsOverline')} testID="support-topics">
      {categories.map((category) => (
        <ListItem
          key={category.slug}
          icon={topicGlyph(category.slug)}
          title={topicLabel(category)}
          onPress={() => onPick(category.slug)}
          testID={`support-topic-${category.slug}`}
        />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  overline: { marginBottom: layout.sectionHeaderGap, marginStart: space[4] },
  skeleton: { gap: space[1] },
});
