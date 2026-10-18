import React from 'react';
import { View } from 'react-native';
import { TextField } from '../../../components/ui';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import { Anchored, FormGroup, stepStyles, useStepFields, type StepProps } from './stepParts';

const P = REGISTRATION_FIELDS.payout;

/**
 * Driver page "Payout" (UI-R7): bank name, branch and account number or IBAN. The fields belong
 * to the schema's `vehicle` step (registrationSchema), validated on this page only (pages.ts).
 */
export default function PayoutStep(props: StepProps) {
  const { data } = props;
  const f = useStepFields('vehicle', props);
  const { errors } = f;
  return (
    <View style={stepStyles.step}>
      <FormGroup>
        <Anchored field="bankName">
          <TextField
            label={P.bankName}
            required={f.required('bankName')}
            placeholder={P.bankNamePlaceholder}
            value={data.bankName}
            onChangeText={(value) => f.set('bankName', value)}
            onBlur={() => f.blur('bankName')}
            autoCapitalize="characters"
            error={errors.bankName}
            testID="registration-bank-name"
          />
        </Anchored>
        <Anchored field="bankBranch">
          <TextField
            label={P.bankBranch}
            required={f.required('bankBranch')}
            placeholder={P.bankBranchPlaceholder}
            value={data.bankBranch}
            onChangeText={(value) => f.set('bankBranch', value)}
            onBlur={() => f.blur('bankBranch')}
            autoCapitalize="words"
            error={errors.bankBranch}
            testID="registration-bank-branch"
          />
        </Anchored>
        <Anchored field="bankAccountNumber">
          <TextField
            label={P.account}
            required={f.required('bankAccountNumber')}
            placeholder={P.accountPlaceholder}
            value={data.bankAccountNumber}
            onChangeText={(value) => f.set('bankAccountNumber', value.toUpperCase())}
            onBlur={() => f.blur('bankAccountNumber')}
            // An IBAN has letters (PK36SCBL…), so not the number pad.
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={50}
            error={errors.bankAccountNumber}
            testID="registration-bank-account"
          />
        </Anchored>
      </FormGroup>
    </View>
  );
}
