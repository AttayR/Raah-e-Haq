import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Card, Icon, type IconName } from '../../../components/ui';
import { REGISTRATION_COPY } from '../../../features/auth/copy/registration';
import type { RegistrationRole } from '../../../features/auth/registration/registrationForm';
import { componentTokens, radius, space } from '../../../theme';

const C = REGISTRATION_COPY.role;
const w = componentTokens.wizard;

// T-579: the card texts are read at render (not copied into a module-level list), so the cards
// follow a live language switch.
const ROLES: ReadonlyArray<{ role: RegistrationRole; icon: IconName; title: () => string; body: () => string }> = [
  { role: 'passenger', icon: 'account', title: () => C.rideTitle, body: () => C.rideBody },
  { role: 'driver', icon: 'steering', title: () => C.driveTitle, body: () => C.driveBody },
];

type Props = {
  /** The chosen role, or null until one is tapped. */
  value: RegistrationRole | null;
  onChange: (role: RegistrationRole) => void;
};

/**
 * Wizard page 0 (spec auth-registration): two stacked selectable cards, "I want to ride" and
 * "I want to drive", with an MDI glyph in a 48 `primarySoft` circle and a trailing radio. The role
 * decides the pages that follow (passengers 3 steps, drivers 5).
 */
export default function RoleStep({ value, onChange }: Props) {
  const { theme } = useAppTheme();
  const { height } = useWindowDimensions();
  const minHeight = height < w.compactWindowHeight ? w.compactChoiceMinHeight : w.choiceMinHeight;
  return (
    <View style={styles.list} accessibilityRole="radiogroup" accessibilityLabel={C.groupA11y}>
      {ROLES.map(({ role, icon, title: titleOf, body: bodyOf }) => {
        const selected = value === role;
        const title = titleOf();
        const body = bodyOf();
        return (
          <Card
            key={role}
            variant={selected ? 'selected' : 'outlined'}
            onPress={() => onChange(role)}
            accessibilityRole="radio"
            accessibilityLabel={`${title}. ${body}`}
            style={[styles.card, { minHeight }]}
            testID={`registration-role-${role}`}
          >
            <View style={[styles.glyph, { backgroundColor: selected ? theme.colors.surface : theme.colors.primarySoft }]}>
              <Icon name={icon} size={24} color="onPrimarySoft" />
            </View>
            <View style={styles.text}>
              <AppText variant="title">{title}</AppText>
              <AppText variant="bodySmall" color="textSecondary">
                {body}
              </AppText>
            </View>
            <Icon name={selected ? 'radioOn' : 'radioOff'} size={24} color={selected ? 'primaryText' : 'textMuted'} />
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[3] },
  card: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  glyph: {
    width: w.choiceIconTile,
    height: w.choiceIconTile,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: space[0] },
});
