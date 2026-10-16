import React, { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  Card,
  Checkbox,
  ErrorState,
  Header,
  Icon,
  ListGroup,
  ListItem,
  Screen,
  SkeletonList,
  Switch,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useParcelOptIn } from '../hooks';
import type { ParcelOptIn } from '../types';

function OptInDetails({ summary, saving, onToggle }: { summary: ParcelOptIn; saving: boolean; onToggle: (on: boolean) => void }) {
  // Opting in needs the rules accepted on this screen first (the server asks for accept_rules).
  const [accepted, setAccepted] = useState(summary.optedIn);
  const [needsAccept, setNeedsAccept] = useState(false);
  const toggle = (on: boolean) => {
    if (on && !accepted) {
      setNeedsAccept(true);
      return;
    }
    onToggle(on);
  };
  const disabled = saving || (!summary.optedIn && !summary.hasApprovedBike);

  return (
    <>
      <ListGroup>
        <ListItem
          icon="parcel"
          title={t('parcel.optInToggle')}
          checked={summary.optedIn}
          disabled={disabled}
          trailing={
            <Switch
              value={summary.optedIn}
              onValueChange={toggle}
              accessibilityLabel={t('parcel.optInToggle')}
              disabled={disabled}
              testID="parcel-opt-in-switch"
            />
          }
          testID="parcel-opt-in-toggle"
        />
      </ListGroup>
      {!summary.hasApprovedBike ? <Banner tone="warning" icon="bike" text={t('parcel.optInNoBike')} testID="parcel-opt-in-no-bike" /> : null}
      {summary.optedIn && !summary.tierActive ? <Banner tone="info" text={t('parcel.optInTierOff')} testID="parcel-opt-in-tier-off" /> : null}
      {summary.getsParcelRequests ? <Banner tone="success" text={t('parcel.optInGets')} testID="parcel-opt-in-gets" /> : null}
      <Card testID="parcel-opt-in-rules">
        <View style={styles.rules}>
          <AppText variant="title" accessibilityRole="header">
            {t('parcel.optInRulesTitle')}
          </AppText>
          {summary.prohibitedItems.map((item, index) => (
            <View key={index} style={styles.rule}>
              <Icon name="blocked" size={16} color="danger" />
              <AppText variant="bodySmall" style={styles.flex}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      {!summary.optedIn ? (
        <Checkbox
          label={t('parcel.optInAccept')}
          checked={accepted}
          onChange={(on) => {
            setAccepted(on);
            setNeedsAccept(false);
          }}
          testID="parcel-opt-in-accept"
        />
      ) : null}
      {needsAccept ? (
        <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="parcel-opt-in-accept-error">
          {t('parcel.optInAcceptRequired')}
        </AppText>
      ) : null}
    </>
  );
}

/**
 * Driver Account → Parcel deliveries (T-522, BE-88): opt in to parcel requests (bike drivers with
 * an approved bike; the server answers 409 NO_APPROVED_BIKE otherwise) after accepting the rules,
 * or opt out. The prohibited list is the server's.
 */
export default function ParcelOptInScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const optIn = useParcelOptIn(isFocused);

  let body: React.ReactNode;
  if (optIn.data) {
    body = <OptInDetails summary={optIn.data} saving={optIn.saving} onToggle={(on) => optIn.setEnabled(on)} />;
  } else if (optIn.status === 'failed') {
    body = (
      <ErrorState title={t('parcel.optInLoadFailed')} body={optIn.error ?? undefined} retryLabel={t('parcel.retry')} onRetry={optIn.reload} testID="parcel-opt-in-error" />
    );
  } else {
    body = <SkeletonList rows={2} testID="parcel-opt-in-loading" />;
  }

  return (
    <Screen
      scroll
      testID="parcel-opt-in-screen"
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={optIn.status === 'refreshing'} onRefresh={optIn.refresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
      }
    >
      <Header title={t('parcel.optInTitle')} backLabel={t('parcel.back')} onBack={() => navigation.goBack()} tone="background" testID="parcel-opt-in" />
      <View style={styles.body}>
        <AppText variant="bodySmall" color="textSecondary">
          {t('parcel.optInIntro')}
        </AppText>
        {optIn.saveError ? <Banner tone="danger" text={optIn.saveError} testID="parcel-opt-in-save-error" /> : null}
        {body}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  body: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[3], width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center' },
  rules: { gap: space[2] },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  flex: { flex: 1 },
});
