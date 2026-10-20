import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Skeleton, SkeletonGroup, SkeletonListItem } from '../../../components/ui';
import { layout, space } from '../../../theme';

/**
 * First load of Saved places (§S4): the two slot rows, the "Other places" heading and two more
 * rows, each 72 high like the loaded rows, so nothing jumps when the list arrives.
 */
export function SavedPlacesSkeleton() {
  return (
    <SkeletonGroup testID="saved-places-loading" style={styles.container}>
      <Card padding="none">
        <SkeletonListItem />
        <SkeletonListItem />
      </Card>
      <View style={styles.section}>
        <Skeleton width={space[12] * 2} height={space[3]} />
        <Card padding="none">
          <SkeletonListItem />
          <SkeletonListItem />
        </Card>
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: layout.gutter, paddingTop: space[2], gap: layout.sectionGap },
  section: { gap: layout.sectionHeaderGap },
});
