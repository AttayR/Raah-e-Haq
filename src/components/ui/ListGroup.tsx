import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, space } from '../../theme';
import { AppText } from './AppText';
import { Card } from './Card';

export type ListGroupProps = React.PropsWithChildren<{
  /** Section header (`overline`, `textMuted`), 8 above the group. */
  title?: string;
  /**
   * Divider inset to the rows' text start (§5.8): `tile` (default, 40 tile or Avatar 40 → 72),
   * `icon` (plain 24 glyph → 56) or `none` (text rows → 16).
   */
  inset?: 'tile' | 'icon' | 'none';
  testID?: string;
}>;

/**
 * Grouped list (DESIGN_SYSTEM §5.8): rows inside a Card with no padding, hairline dividers
 * inset to the text start, optional section header.
 */
export function ListGroup({ title, inset = 'tile', testID, children }: ListGroupProps) {
  const { theme } = useAppTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View testID={testID}>
      {title ? (
        <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.header}>
          {title}
        </AppText>
      ) : null}
      <Card padding="none" style={styles.card}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? (
              <View
                style={[
                  { marginStart: componentTokens.listItem.dividerInset[inset] },
                  { backgroundColor: theme.colors.border, height: theme.borderWidth.hairline },
                ]}
              />
            ) : null}
            {row}
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: space[2], marginStart: space[4] },
  card: { overflow: 'hidden' },
});
