import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Checkbox, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';

type Props = {
  /** The server's list (GET /parcels/options `prohibited_items`). */
  items: ReadonlyArray<string>;
  /** The server's declaration text, which the checkbox accepts. */
  declaration: string;
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
  /** T-578: the checkbox and its error, so a refused submit can scroll to them. */
  anchorRef?: (node: View | null) => void;
  testID?: string;
};

/** "Do not send" (the prohibited list) and the declaration the sender accepts (BE-88). */
export function ParcelDeclaration({ items, declaration, accepted, onChange, error, anchorRef, testID = 'parcel-declaration' }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Card>
        <View style={styles.list}>
          <AppText variant="title" accessibilityRole="header">
            {t('parcel.prohibitedTitle')}
          </AppText>
          {items.map((item, index) => (
            <View key={index} style={styles.row} testID={`${testID}-item-${index}`}>
              <Icon name="blocked" size={16} color="danger" />
              <AppText variant="bodySmall" style={styles.flex}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      <View ref={anchorRef} style={styles.wrap} testID={`${testID}-anchor`}>
        <Checkbox
          label={declaration || t('parcel.declarationRequired')}
          checked={accepted}
          onChange={onChange}
          testID={`${testID}-accept`}
        />
        {error ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID={`${testID}-error`}>
            {error}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  list: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  flex: { flex: 1 },
});
