import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText, Card, Icon } from '../../../components/ui';
import { VEHICLE_TYPES, vehicleTypeText } from '../../../features/auth/registration/registrationForm';
import { componentTokens, space } from '../../../theme';

const w = componentTokens.wizard;

type Props = {
  value: string;
  onChange: (id: string) => void;
  accessibilityLabel: string;
};

/**
 * Vehicle type as a 2×2 grid of selectable cards (spec auth-registration): glyph 32, name and the
 * kinds it covers. Selected = `Card selected` (2pt primary + primarySoft). 76 high on small phones.
 */
export default function VehicleTypePicker({ value, onChange, accessibilityLabel }: Props) {
  const { height } = useWindowDimensions();
  const minHeight = height < w.compactWindowHeight ? w.compactChoiceMinHeight : w.choiceMinHeight;
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {VEHICLE_TYPES.map((type) => {
        const selected = value === type.id;
        // T-575: name and kinds in the active language.
        const text = vehicleTypeText(type.id) ?? type;
        return (
          <Card
            key={type.id}
            variant={selected ? 'selected' : 'outlined'}
            onPress={() => onChange(type.id)}
            accessibilityRole="radio"
            accessibilityLabel={`${text.label}, ${text.description}`}
            style={[styles.card, { minHeight }]}
            testID={`registration-vehicle-type-${type.id}`}
          >
            <Icon name={type.icon} size={32} color={selected ? 'onPrimarySoft' : 'primaryText'} />
            <AppText variant="bodyStrong" color={selected ? 'onPrimarySoft' : 'textPrimary'}>
              {text.label}
            </AppText>
            <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
              {text.description}
            </AppText>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  // Two per row: each card takes half the row less half the gap.
  card: { flexBasis: '45%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space[1] },
});
