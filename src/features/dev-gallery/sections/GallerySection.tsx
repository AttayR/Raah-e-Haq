import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui';
import { layout, space } from '../../../theme';

type Props = React.PropsWithChildren<{ title: string; hint?: string; testID?: string }>;

/** A titled gallery block: `title` heading, optional hint, 24 between blocks (§3.2). */
export function GallerySection({ title, hint, testID, children }: Props) {
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="bodySmall" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: layout.sectionGap, gap: space[1] },
  body: { marginTop: layout.sectionHeaderGap, gap: space[2] },
});
