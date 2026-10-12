import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, IconButton } from '../../../components/ui';
import { space } from '../../../theme';

type Props = { title: string; backLabel: string; onBack: () => void; testID?: string };

/** Stack screen header: back button and a large title. */
export function ScreenHeader({ title, backLabel, onBack, testID }: Props) {
  return (
    <View style={styles.header}>
      <IconButton icon="back" accessibilityLabel={backLabel} onPress={onBack} testID={testID ? `${testID}-back` : undefined} />
      <AppText variant="h2" accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[2],
    paddingTop: space[2],
    paddingBottom: space[2],
  },
  title: { flex: 1, minWidth: 0 },
});
