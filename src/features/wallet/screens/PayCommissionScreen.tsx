import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { AppText, Banner, Button, Card, Header, Screen, SegmentedControl, TextField } from '../../../components/ui';
import { firstFieldMessages, toApiError } from '../../../core/api/errors';
import { formatMoney, moneyInputText } from '../../../core/format/money';
import { toast } from '../../../core/toast';
import { layout, space } from '../../../theme';
import { WALLET_COPY } from '../copy';
import { submitSettlement } from '../hooks';
import type { DriverWalletRoutes } from '../navigation';
import {
  SETTLEMENT_NOTE_MAX,
  SETTLEMENT_REFERENCE_MAX,
  validateSettlementForm,
  type SettlementFormErrors,
  type SettlementFormValues,
} from '../settlementForm';
import type { SettlementMethod } from '../types';
import { perLocale } from '../../../i18n';

const METHODS = perLocale(() => [
  { value: 'cash', label: WALLET_COPY.methodCash },
  { value: 'bank_transfer', label: WALLET_COPY.methodBank },
] as const);

/** Server refusals that belong under the amount field rather than in a toast. */
const AMOUNT_CODES = new Set(['AMOUNT_EXCEEDS_OWED', 'NOTHING_OWED']);

/**
 * Driver: report a commission payment (T-508, POST /wallet/settlements). The amount starts
 * at `commission_owed`; the method is cash at the office or bank transfer (reference then
 * required). Checked here first (> 0, ≤ owed, reference format), then by the server, whose
 * refusal (already pending, nothing owed, more than owed) is shown. On success the Wallet
 * shows the report as waiting for review.
 */
export default function PayCommissionScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<RouteProp<DriverWalletRoutes, 'PayCommission'>>();
  const { owed, currency } = params;
  const [values, setValues] = useState<SettlementFormValues>({
    amount: moneyInputText(owed),
    method: 'cash',
    reference: '',
    note: '',
  });
  const [errors, setErrors] = useState<SettlementFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A ref, not state: two taps in the same frame both see `submitting` false.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = (field: keyof SettlementFormValues) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    if (field !== 'method') setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const onSubmit = async () => {
    if (inFlight.current) return;
    // The first tap submits; the keypad closes so errors and the result are not hidden by it.
    Keyboard.dismiss();
    const result = validateSettlementForm(values, owed, currency);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await submitSettlement(result.request);
      toast.success(WALLET_COPY.formSubmitted);
      if (mounted.current) navigation.goBack();
    } catch (cause) {
      const apiError = toApiError(cause);
      if (apiError.kind === 'cancelled' || !mounted.current) return;
      const fields = firstFieldMessages(apiError.fieldErrors);
      if (apiError.code && AMOUNT_CODES.has(apiError.code)) {
        setErrors({ amount: apiError.message });
      } else if (fields.amount || fields.reference || fields.note || fields.method) {
        setErrors({ amount: fields.amount, reference: fields.reference ?? fields.method, note: fields.note });
      } else {
        // 409 already pending, 429, network: server text when it is written for people.
        setFormError(apiError.kind === 'unknown' || apiError.kind === 'server' ? WALLET_COPY.formFailed : apiError.message);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  const bank = values.method === 'bank_transfer';

  return (
    // Screen's keyboard avoidance (top-inset offset, T-509) keeps "Report payment" above the keypad.
    <Screen testID="pay-commission-screen" keyboardAvoiding>
      <Header
        title={WALLET_COPY.formTitle}
        backLabel={WALLET_COPY.back}
        onBack={() => navigation.goBack()}
        tone="background"
        testID="pay-commission"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <AppText variant="caption" color="textSecondary">
            {WALLET_COPY.formOwed}
          </AppText>
          <AppText variant="numericL" testID="pay-commission-owed">
            {formatMoney(owed, { currency })}
          </AppText>
        </Card>

        <TextField
          label={WALLET_COPY.formAmount}
          value={values.amount}
          onChangeText={update('amount')}
          keyboardType="decimal-pad"
          inputMode="decimal"
          doneBar
          error={errors.amount}
          testID="pay-commission-amount"
        />

        <View style={styles.field}>
          <AppText variant="label" color="textSecondary">
            {WALLET_COPY.formMethod}
          </AppText>
          <SegmentedControl<SettlementMethod>
            options={METHODS()}
            value={values.method}
            onChange={(method) => {
              setValues((current) => ({ ...current, method }));
              setErrors((current) => ({ ...current, reference: undefined }));
            }}
            accessibilityLabel={WALLET_COPY.formMethod}
            testID="pay-commission-method"
          />
        </View>

        <TextField
          label={bank ? WALLET_COPY.formReference : WALLET_COPY.formReferenceOptional}
          value={values.reference}
          onChangeText={update('reference')}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={SETTLEMENT_REFERENCE_MAX}
          helper={WALLET_COPY.formReferenceHint}
          error={errors.reference}
          testID="pay-commission-reference"
        />

        <TextField
          label={WALLET_COPY.formNote}
          value={values.note}
          onChangeText={update('note')}
          multiline
          maxLength={SETTLEMENT_NOTE_MAX}
          doneBar
          error={errors.note}
          testID="pay-commission-note"
        />

        <Banner tone="info" icon="info" text={WALLET_COPY.formInfo} />

        {formError ? (
          <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="pay-commission-error">
            {formError}
          </AppText>
        ) : null}

        <Button
          label={WALLET_COPY.formSubmit}
          onPress={() => {
            onSubmit();
          }}
          loading={submitting}
          testID="pay-commission-submit"
        />
      </ScrollView>
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
  field: { gap: space[1] },
});
