import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, type IconName } from '../../../components/ui';
import { radius, space } from '../../../theme';

type Props = {
  icon: IconName;
  text: string;
  title?: string;
  tone?: 'info' | 'warning';
  testID?: string;
};

/** Inline banner (info or warning tone): an icon, an optional bold title and one paragraph. */
export function InfoNote({ icon, text, title, tone = 'info', testID }: Props) {
  const { theme } = useAppTheme();
  const fill = tone === 'warning' ? theme.colors.warningSoft : theme.colors.infoSoft;
  return (
    <View style={[styles.note, { backgroundColor: fill }]} testID={testID}>
      <Icon name={icon} size={20} color={tone} />
      <View style={styles.text}>
        {title ? (
          <AppText variant="label" color={tone}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="bodySmall" color="textPrimary">
          {text}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  text: { flex: 1, minWidth: 0, gap: space[1] / 2 },
});
