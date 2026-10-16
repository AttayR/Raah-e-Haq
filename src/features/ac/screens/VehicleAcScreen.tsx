import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorState,
  Header,
  ListGroup,
  ListItem,
  Screen,
  SkeletonList,
  Switch,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { vehicleAcStatusText, vehicleAcStatusTone } from '../format';
import { useVehicleAc } from '../hooks';
import type { VehicleAcSummary } from '../types';

function AcDetails({ summary, saving, onToggle }: { summary: VehicleAcSummary; saving: boolean; onToggle: (on: boolean) => void }) {
  const vehicle = summary.vehicle;
  if (!vehicle) {
    return <EmptyState icon="car" title={t('ac.noVehicleTitle')} body={t('ac.noVehicleBody')} testID="vehicle-ac-no-vehicle" />;
  }
  const isCar = vehicle.vehicleType === null || vehicle.vehicleType === 'car';
  // Only once AC is declared do the server's "still needed" items apply to the driver.
  const problems = vehicle.hasAc ? summary.problems : [];
  return (
    <>
      <ListGroup>
        <ListItem
          icon="ac"
          title={t('ac.toggleLabel')}
          subtitle={summary.minVehicleYear ? t('ac.minYear', { year: summary.minVehicleYear }) : undefined}
          disabled={saving || (!isCar && !vehicle.hasAc)}
          trailing={
            <Switch
              value={vehicle.hasAc}
              onValueChange={onToggle}
              accessibilityLabel={t('ac.toggleLabel')}
              disabled={saving || (!isCar && !vehicle.hasAc)}
              testID="vehicle-ac-switch"
            />
          }
          testID="vehicle-ac-toggle"
        />
      </ListGroup>
      <Card testID="vehicle-ac-status">
        <View style={styles.statusRow}>
          <AppText variant="label" color="textSecondary">
            {t('ac.statusLabel')}
          </AppText>
          <Badge label={vehicleAcStatusText(vehicle.acStatus)} tone={vehicleAcStatusTone(vehicle.acStatus)} testID="vehicle-ac-status-badge" />
        </View>
        {vehicle.acReason ? (
          <AppText variant="bodySmall" color="textSecondary" style={styles.reason} testID="vehicle-ac-reason">
            {t('ac.reason', { reason: vehicle.acReason })}
          </AppText>
        ) : null}
      </Card>
      {summary.servesAcRides ? <Banner tone="success" text={t('ac.servesNow')} testID="vehicle-ac-serves" /> : null}
      {problems.length > 0 ? (
        <ListGroup title={t('ac.missingTitle')}>
          {problems.map((p) => (
            <ListItem key={p.code} icon="info" title={p.message} testID={`vehicle-ac-problem-${p.code}`} />
          ))}
        </ListGroup>
      ) : null}
    </>
  );
}

/**
 * Driver Account → Vehicle AC (T-522, BE-86): declare that the car has working AC (it goes to
 * the admin; approved cars get AC ride requests) or withdraw it, with the status, the admin's
 * reason for a rejection or suspension, and what is still missing (year, photos, approval).
 */
export default function VehicleAcScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const ac = useVehicleAc(isFocused);

  let body: React.ReactNode;
  if (ac.data) {
    body = <AcDetails summary={ac.data} saving={ac.saving} onToggle={(on) => ac.setHasAc(on)} />;
  } else if (ac.status === 'failed') {
    body = (
      <ErrorState title={t('ac.loadFailed')} body={ac.error ?? undefined} retryLabel={t('ac.retry')} onRetry={ac.reload} testID="vehicle-ac-error" />
    );
  } else {
    body = <SkeletonList rows={2} testID="vehicle-ac-loading" />;
  }

  return (
    <Screen
      scroll
      testID="vehicle-ac-screen"
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={ac.status === 'refreshing'} onRefresh={ac.refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
      }
    >
      <Header title={t('ac.screenTitle')} backLabel={t('ac.back')} onBack={() => navigation.goBack()} tone="background" testID="vehicle-ac" />
      <View style={styles.body}>
        <AppText variant="bodySmall" color="textSecondary">
          {t('ac.intro')}
        </AppText>
        {ac.saveError ? <Banner tone="danger" text={ac.saveError} testID="vehicle-ac-save-error" /> : null}
        {body}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  reason: { marginTop: space[2] },
});
