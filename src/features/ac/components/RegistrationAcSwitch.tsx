import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Icon, Switch } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';

type Props = {
  value: boolean;
  onChange: (on: boolean) => void;
  /** The server's refusal (422 vehicle_has_ac: not a car, or older than the AC minimum year). */
  error?: string | null;
  /**
   * BE-105: the AC minimum model year from GET /public/vehicle-types when the chosen year is
   * older; the switch is then off and disabled, with the reason as its hint.
   */
  tooOldMinYear?: number | null;
};

/**
 * Registration, vehicle step (BE-86): "My car has working AC" for a car. Optional; the server
 * puts it under review (AC rides only once an admin approves the car).
 */
export function RegistrationAcSwitch({ value, onChange, error, tooOldMinYear = null }: Props) {
  const blocked = tooOldMinYear !== null;
  return (
    <View style={styles.wrap} testID="registration-ac">
      <View style={styles.row}>
        <Icon name="ac" size={20} color="textSecondary" />
        <View style={styles.text}>
          <AppText variant="body">{t('ac.registerLabel')}</AppText>
          <AppText variant="caption" color="textMuted" testID="registration-ac-hint">
            {blocked ? t('ac.registerTooOld', { year: tooOldMinYear }) : t('ac.registerHint')}
          </AppText>
        </View>
        <Switch
          value={blocked ? false : value}
          onValueChange={onChange}
          disabled={blocked}
          accessibilityLabel={t('ac.registerLabel')}
          testID="registration-ac-switch"
        />
      </View>
      {error && !blocked ? (
        <AppText variant="bodySmall" color="danger" testID="registration-ac-error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  text: { flex: 1, minWidth: 0, gap: space[0] },
});
