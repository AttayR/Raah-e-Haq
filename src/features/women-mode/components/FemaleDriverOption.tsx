import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, ListGroup, ListItem, Switch } from '../../../components/ui';
import { t } from '../../../i18n';
import type { User } from '../../../services/api';
import { space } from '../../../theme';
import { formatDateTime } from '../../wallet/format';
import { toFemaleDriverRequest } from '../api';
import { useFemaleDriverAvailability } from '../hooks';
import { femaleDriverOptionOf } from '../rules';
import type { FemaleAvailability, FemaleDriverRequest } from '../types';

type LatLng = { latitude: number; longitude: number };

type ViewProps = {
  request: FemaleDriverRequest | null;
  pickup: LatLng | null;
  vehicleType: string | null | undefined;
  value: boolean;
  onChange: (on: boolean) => void;
};

const hintFor = (availability: FemaleAvailability): { text: string; tone: 'textSecondary' | 'warning' } | null => {
  switch (availability.status) {
    case 'checking':
      return { text: t('womenMode.checking'), tone: 'textSecondary' };
    case 'ready':
      return availability.available
        ? { text: t('womenMode.nearby'), tone: 'textSecondary' }
        : { text: t('womenMode.noneNearby'), tone: 'warning' };
    case 'limited':
      return { text: t('womenMode.limited'), tone: 'textSecondary' };
    case 'failed':
      return { text: t('womenMode.checkFailed'), tone: 'textSecondary' };
    default:
      return null;
  }
};

/**
 * "Female driver" on the fare step (BE-87), only for a passenger the server lets ask: a switch,
 * or (new account / recent gender change) switched off with the date it opens. While on, one
 * availability check for the pickup says whether a female driver is near; booking works either
 * way (the server asks before anyone else is matched). The map's driver list never changes.
 */
export function FemaleDriverOptionView({ request, pickup, vehicleType, value, onChange }: ViewProps) {
  const { theme } = useAppTheme();
  const option = femaleDriverOptionOf(request);
  const on = option.kind === 'available' && value;
  const availability = useFemaleDriverAvailability(pickup, vehicleType, on);

  // The profile no longer allows it (gender changed, women mode off): never send it.
  useEffect(() => {
    if (option.kind !== 'available' && value) onChange(false);
  }, [option.kind, value, onChange]);

  if (option.kind === 'hidden') return null;
  const waiting = option.kind === 'waiting';
  const from = waiting && option.availableFrom ? formatDateTime(option.availableFrom) : '';
  const hint = on ? hintFor(availability) : null;

  return (
    <View style={styles.wrap} testID="female-driver-option">
      <ListGroup>
        <ListItem
          icon="womenMode"
          title={t('womenMode.optionTitle')}
          subtitle={waiting ? (from ? t('womenMode.availableFrom', { date: from }) : undefined) : t('womenMode.optionSubtitle')}
          disabled={waiting}
          trailing={
            <Switch
              value={on}
              onValueChange={onChange}
              accessibilityLabel={t('womenMode.optionA11y')}
              disabled={waiting}
              testID="female-driver-switch"
            />
          }
          testID="female-driver-row"
        />
      </ListGroup>
      {hint ? (
        <View style={styles.hint} accessibilityLiveRegion="polite">
          {availability.status === 'checking' ? <ActivityIndicator size="small" color={theme.colors.primaryText} /> : null}
          <AppText variant="bodySmall" color={hint.tone} style={styles.hintText} testID="female-driver-hint">
            {hint.text}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

type Props = Omit<ViewProps, 'request'>;

// Typed locally (not RootState) so this component never imports the store singleton.
const selectFemaleDriverRequest = (state: { apiAuth: { user: User | null } }) => state.apiAuth.user?.female_driver_request;

/** FemaleDriverOptionView with the signed-in passenger's profile block. */
export function FemaleDriverOption(props: Props) {
  const raw = useSelector(selectFemaleDriverRequest);
  return <FemaleDriverOptionView {...props} request={toFemaleDriverRequest(raw)} />;
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  hintText: { flexShrink: 1 },
});
