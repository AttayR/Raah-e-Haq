import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, space } from '../../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { ListItem, type ListItemProps } from './ListItem';

type Inset = 'tile' | 'icon' | 'none';

export type ListGroupProps = React.PropsWithChildren<{
  /** Section header (`overline`, `textMuted`), 8 above the group. */
  title?: string;
  /**
   * Divider inset to the rows' text start (§5.8): `tile` (40 tile or Avatar 40 → 72), `icon`
   * (plain 24 glyph → 56) or `none` (text rows → 16). When omitted, each divider follows the
   * content start of the `ListItem` above it (T-540: a row without an icon gets the 16 gutter);
   * other row components get `tile`.
   */
  inset?: Inset;
  testID?: string;
}>;

/**
 * Grouped list (DESIGN_SYSTEM §5.8): rows inside a Card with no padding, hairline dividers
 * inset to the text start, optional section header.
 */
/** Where a row's text starts, read from its ListItem props; null for other row components. */
function rowInset(row: React.ReactNode): Inset | null {
  if (!React.isValidElement<ListItemProps>(row) || row.type !== ListItem) return null;
  const { leading, icon, iconStyle } = row.props;
  if (leading) return 'tile';
  if (!icon) return 'none';
  return iconStyle === 'plain' ? 'icon' : 'tile';
}

export function ListGroup({ title, inset, testID, children }: ListGroupProps) {
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
                testID={testID ? `${testID}-divider-${index}` : undefined}
                style={[
                  {
                    marginStart:
                      componentTokens.listItem.dividerInset[inset ?? rowInset(rows[index - 1]) ?? 'tile'],
                  },
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
