import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Icon } from '../../../components/ui';
import { triggerHaptic } from '../../../core/haptics';
import { space } from '../../../theme';
import type { TopUpProvider } from '../types';

type Props = {
  providers: ReadonlyArray<TopUpProvider>;
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  error?: string;
};

/**
 * One selectable card per gateway the server lists (GET /wallet `top_up.providers`; never a
 * hardcoded list): JazzCash, Easypaisa, or the local test gateway. Radio semantics.
 */
export function TopUpProviderPicker({ providers, value, onChange, label, error }: Props) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      {providers.map((provider) => {
        const selected = provider.id === value;
        return (
          <Card
            key={provider.id}
            variant={selected ? 'selected' : 'outlined'}
            onPress={() => {
              if (!selected) triggerHaptic('selection');
              onChange(provider.id);
            }}
            accessibilityRole="radio"
            accessibilityLabel={provider.name}
            testID={`top-up-provider-${provider.id}`}
          >
            <View style={styles.row}>
              <Icon name="wallet" size={24} color={selected ? 'onPrimarySoft' : 'textSecondary'} />
              <AppText variant="bodyStrong" style={styles.name} numberOfLines={1}>
                {provider.name}
              </AppText>
              {selected ? <Icon name="checkMark" size={20} color="primaryText" /> : null}
            </View>
          </Card>
        );
      })}
      {error ? (
        <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="top-up-provider-error">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  name: { flex: 1, minWidth: 0 },
});
