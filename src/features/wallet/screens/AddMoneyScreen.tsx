import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation, useRoute, type ParamListBase, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootState } from '../../../store';
import {
  AppText,
  Banner,
  Button,
  Chip,
  ErrorState,
  Header,
  Screen,
  SegmentedControl,
  SkeletonList,
  TextField,
} from '../../../components/ui';
import { firstFieldMessages, toApiError, type ApiError } from '../../../core/api/errors';
import { formatMoney } from '../../../core/format/money';
import { triggerHaptic } from '../../../core/haptics';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { KeyboardDoneBar } from '../components/KeyboardDoneBar';
import { TopUpProviderPicker } from '../components/TopUpProviderPicker';
import { WALLET_COPY } from '../copy';
import { useWallet } from '../hooks';
import { TOP_UP_CHECKOUT_ROUTE, TOP_UP_STATUS_ROUTE, type WalletRoutes } from '../navigation';
import {
  canTopUpToday,
  needsCnic,
  prefillTopUpAmount,
  topUpFieldErrors,
  topUpPresets,
  validateTopUpForm,
  type TopUpFormErrors,
  type TopUpFormValues,
} from '../topUpForm';
import { useCreateTopUp } from '../topUpHooks';
import { isAllowedCheckoutUrl } from '../topUpLinks';
import type { TopUpConfig, TopUpMethod, TopUpResult } from '../types';

export const ADD_MONEY_KEYBOARD_DONE_ID = 'addMoneyKeyboardDone';

/** Refusals that belong under the amount field (BE-74). */
const AMOUNT_CODES = new Set(['DAILY_LIMIT_REACHED']);
/** The gateway or method was switched off meanwhile: GET /wallet is read again. */
const PROVIDER_CODES = new Set(['PROVIDER_UNAVAILABLE', 'METHOD_UNAVAILABLE']);

const METHOD_LABEL: Record<TopUpMethod, string> = {
  mwallet: t('topUp.methodMwallet'),
  card: t('topUp.methodCard'),
};

const initialValues = (config: TopUpConfig | null): TopUpFormValues => {
  const only = config?.providers.length === 1 ? config.providers[0] : null;
  return {
    amount: '',
    provider: only?.id ?? null,
    method: only ? only.methods[0] : null,
    mobile: '',
    cnic: '',
  };
};

/**
 * Add money (T-515, BE-74): amount (preset chips within min..max and today's remaining limit,
 * or typed), the gateway from GET /wallet, and the method: the gateway's mobile account (number;
 * JazzCash also the CNIC's last 6 digits) or its hosted checkout. Checked here first, then by the
 * server. A checkout opens in the in-app browser; a mobile-account payment goes straight to the
 * status screen, which polls the result. Rides stay cash; a driver's top-up first pays off the
 * commission owed.
 */
export default function AddMoneyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const isDriver = useSelector((state: RootState) => state.apiAuth.user?.role === 'driver');
  const wallet = useWallet(isFocused);
  const config = wallet.data?.canTopUp ? wallet.data.topUp : null;
  const { create, submitting } = useCreateTopUp();

  const [values, setValues] = useState<TopUpFormValues>(() => initialValues(null));
  const [errors, setErrors] = useState<TopUpFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Preselect the only gateway once the wallet has loaded.
  useEffect(() => {
    if (config?.providers.length === 1 && values.provider === null) {
      setValues((current) => ({ ...initialValues(config), amount: current.amount }));
    }
  }, [config, values.provider]);

  // T-543: "Top up" from "You owe" fills in the amount owed, within the limits, once.
  const owed = useRoute<RouteProp<WalletRoutes, 'AddMoney'>>().params?.amount;
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !config) return;
    prefilled.current = true;
    const amount = prefillTopUpAmount(owed, config);
    if (amount !== null) setValues((current) => (current.amount === '' ? { ...current, amount: String(amount) } : current));
  }, [config, owed]);

  const set = (patch: Partial<TopUpFormValues>, cleared: Array<keyof TopUpFormErrors>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      cleared.forEach((field) => delete next[field]);
      return next;
    });
    setFormError(null);
  };

  const header = (
    <Header title={t('topUp.title')} backLabel={WALLET_COPY.back} onBack={() => navigation.goBack()} tone="background" testID="add-money" />
  );

  if (!wallet.data || !config) {
    const failed = wallet.status === 'failed' || (wallet.data !== null && !config);
    return (
      <Screen testID="add-money-screen">
        {header}
        {failed ? (
          <ErrorState
            title={wallet.data ? t('topUp.failed') : WALLET_COPY.loadFailed}
            body={wallet.error ?? undefined}
            retryLabel={WALLET_COPY.retry}
            onRetry={wallet.reload}
            testID="add-money-error"
          />
        ) : (
          <SkeletonList rows={4} testID="add-money-loading" />
        )}
      </Screen>
    );
  }

  const money = (amount: number) => formatMoney(amount, { currency: config.currency });
  const presets = topUpPresets(config);
  const provider = config.providers.find((item) => item.id === values.provider) ?? null;
  const methods = provider?.methods ?? [];
  const today = canTopUpToday(config);
  const amountNumber = /^\d+$/.test(values.amount.trim()) ? Number(values.amount.trim()) : null;
  const cnicNeeded = needsCnic(values.provider, values.method);

  const onResult = (result: TopUpResult) => {
    const providerName = provider?.name;
    // Only an https checkout (or the local backend in Debug) opens; anything else goes to the
    // status screen, which reads the result from the server.
    if (result.nextAction.type === 'redirect' && isAllowedCheckoutUrl(result.nextAction.url)) {
      navigation.replace(TOP_UP_CHECKOUT_ROUTE, {
        result,
        url: result.nextAction.url,
        returnUrl: result.nextAction.returnUrl,
        providerName,
      });
    } else {
      navigation.replace(TOP_UP_STATUS_ROUTE, { id: result.topUp.id, result, providerName });
    }
  };

  const onError = (apiError: ApiError) => {
    triggerHaptic('notificationError');
    const fields = topUpFieldErrors(firstFieldMessages(apiError.fieldErrors));
    if (apiError.code && AMOUNT_CODES.has(apiError.code)) {
      setErrors({ amount: apiError.message });
    } else if (apiError.code && PROVIDER_CODES.has(apiError.code)) {
      setErrors({ provider: apiError.message });
      wallet.refresh();
    } else if (Object.keys(fields).length > 0) {
      setErrors(fields);
    } else {
      setFormError(apiError.kind === 'unknown' || apiError.kind === 'server' ? t('topUp.failed') : apiError.message);
    }
  };

  const onPay = async () => {
    // The keypad closes so errors and the result are not hidden by it.
    Keyboard.dismiss();
    const result = validateTopUpForm(values, config);
    if (!result.ok) {
      setErrors(result.errors);
      triggerHaptic('notificationError');
      return;
    }
    setFormError(null);
    try {
      const created = await create(result.request);
      if (created) onResult(created);
    } catch (cause) {
      const apiError = toApiError(cause);
      if (apiError.kind !== 'cancelled') onError(apiError);
    }
  };

  const helper = [
    t('topUp.amountHelper', { min: money(config.minAmount), max: money(config.maxAmount) }),
    config.dailyRemaining < config.maxAmount ? t('topUp.dailyRemaining', { amount: money(config.dailyRemaining) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen testID="add-money-screen" keyboardAvoiding>
      {header}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        {!today ? <Banner tone="warning" text={t('topUp.dailyReached')} testID="add-money-daily-reached" /> : null}

        <TextField
          label={t('topUp.amountLabel')}
          value={values.amount}
          onChangeText={(text) => set({ amount: text.replace(/\D/g, '') }, ['amount'])}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={7}
          inputAccessoryViewID={ADD_MONEY_KEYBOARD_DONE_ID}
          helper={helper}
          error={errors.amount}
          disabled={!today}
          testID="add-money-amount"
        />

        {presets.length > 0 ? (
          <View style={styles.chips} accessibilityLabel={t('topUp.presetsLabel')}>
            {presets.map((amount) => (
              <Chip
                key={amount}
                label={money(amount)}
                selected={amountNumber === amount}
                onPress={() => {
                  triggerHaptic('selection');
                  set({ amount: String(amount) }, ['amount']);
                }}
                testID={`add-money-preset-${amount}`}
              />
            ))}
          </View>
        ) : null}

        <TopUpProviderPicker
          providers={config.providers}
          value={values.provider}
          label={t('topUp.providerLabel')}
          error={errors.provider}
          onChange={(id) => {
            const next = config.providers.find((item) => item.id === id);
            const method = values.method && next?.methods.includes(values.method) ? values.method : next?.methods[0] ?? null;
            set({ provider: id, method }, ['provider', 'method', 'cnic']);
          }}
        />

        {methods.length > 1 && values.method ? (
          <View style={styles.field}>
            <AppText variant="label" color="textSecondary">
              {t('topUp.methodLabel')}
            </AppText>
            <SegmentedControl<TopUpMethod>
              options={methods.map((method) => ({ value: method, label: METHOD_LABEL[method] }))}
              value={values.method}
              onChange={(method) => set({ method }, ['method', 'mobile', 'cnic'])}
              accessibilityLabel={t('topUp.methodLabel')}
              testID="add-money-method"
            />
          </View>
        ) : null}
        {errors.method ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="add-money-method-error">
            {errors.method}
          </AppText>
        ) : null}

        {values.method === 'mwallet' && provider ? (
          <TextField
            variant="phone"
            label={t('topUp.mobileLabel', { provider: provider.name })}
            value={values.mobile}
            onChangeText={(digits) => set({ mobile: digits }, ['mobile'])}
            helper={t('topUp.mobileHelper')}
            error={errors.mobile}
            autoComplete="off"
            textContentType="none"
            inputAccessoryViewID={ADD_MONEY_KEYBOARD_DONE_ID}
            testID="add-money-mobile"
          />
        ) : null}

        {cnicNeeded && provider ? (
          <TextField
            label={t('topUp.cnicLabel')}
            value={values.cnic}
            onChangeText={(text) => set({ cnic: text.replace(/\D/g, '') }, ['cnic'])}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            textContentType="none"
            helper={t('topUp.cnicHelper', { provider: provider.name })}
            error={errors.cnic}
            inputAccessoryViewID={ADD_MONEY_KEYBOARD_DONE_ID}
            testID="add-money-cnic"
          />
        ) : null}

        <Banner tone="info" icon="info" text={isDriver ? t('topUp.driverNote') : t('topUp.cashNote')} />

        {formError ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="add-money-error-text">
            {formError}
          </AppText>
        ) : null}

        <Button
          label={amountNumber ? t('topUp.pay', { amount: money(amountNumber) }) : t('topUp.payGeneric')}
          onPress={() => {
            onPay();
          }}
          loading={submitting}
          disabled={!today}
          haptic="impactLight"
          testID="add-money-pay"
        />
      </ScrollView>
      <KeyboardDoneBar nativeID={ADD_MONEY_KEYBOARD_DONE_ID} label={WALLET_COPY.keyboardDone} testID="add-money-keyboard-done" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[8],
    gap: space[4],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  field: { gap: space[1] },
});
