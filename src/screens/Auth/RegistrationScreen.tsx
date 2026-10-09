import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useApiAuth } from '../../hooks/useApiAuth';
import { useOtpTimers } from '../../hooks/useOtpTimers';
import { BrandColors } from '../../theme/colors';
import PersonalInfoStep from './steps/PersonalInfoStep';
import VehicleInfoStep from './steps/VehicleInfoStep';
import DocumentsStep from './steps/DocumentsStep';
import ReviewStep from './steps/ReviewStep';
import RegistrationHeader from './RegistrationHeader';
import { KeyboardDoneBar } from './PhoneAuthParts';
import { styles } from './RegistrationScreen.styles';
import { toast } from '../../core/toast';
import { logger } from '../../core/logging/logger';
import { rejectionMessage } from '../../core/api/errors';
import { formatCountdown } from '../../services/otpService';
import { registerUserWithImages, type PendingPhoneVerification } from '../../store/thunks/apiThunks';
import { firstInvalidStep, validateStep, type StepErrors } from '../../schemas/registrationSchema';
import {
  INITIAL_REGISTRATION_FORM,
  REGISTRATION_STEPS,
  type RegistrationFormData,
  type RegistrationRole,
  type RegistrationStep,
} from '../../features/auth/registration/registrationForm';
import { buildRegistrationRequest } from '../../features/auth/registration/buildRegistrationRequest';
import RegistrationPhoneStep from '../../features/auth/components/RegistrationPhoneStep';
import { REGISTRATION_COPY as COPY } from '../../features/auth/copy/registration';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';

/** Server field names that belong to the vehicle step (a 422 on them opens that step). */
const DRIVER_FIELDS = [
  'license_type', 'license_expiry_date', 'license_plate', 'registration_number', 'driving_experience',
  'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'bank_name', 'bank_branch',
  'bank_account_number',
];

/** What registration left for the phone step. In memory only: the token is a bearer secret. */
interface PhoneStepState {
  pending: PendingPhoneVerification;
  role: RegistrationRole | null;
}

export default function RegistrationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { registerWithImages } = useApiAuth();
  // BE-53: 429 rate_limited on register holds Create Account for retry_after.
  const { resendIn: submitWait, blockResend: holdSubmit } = useOtpTimers();

  const [currentStep, setCurrentStep] = useState<RegistrationStep>('personal');
  const [submitting, setSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});
  const [apiValidationErrors, setApiValidationErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<RegistrationFormData>(INITIAL_REGISTRATION_FORM);
  const [phoneStep, setPhoneStep] = useState<PhoneStepState | null>(null);
  // One registration at a time: a second tap lands before `submitting` re-renders the button.
  const inFlight = useRef(false);

  const stepIndex = REGISTRATION_STEPS.findIndex((step) => step.key === currentStep);

  const updateFormData = (patch: Partial<RegistrationFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    // An edited field's schema error is stale; the next Next re-validates it.
    setStepErrors((prev) => {
      const next = { ...prev };
      (Object.keys(patch) as (keyof RegistrationFormData)[]).forEach((key) => delete next[key]);
      return next;
    });
  };

  const clearApiError = (field: string) =>
    setApiValidationErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleNext = () => {
    const errors = validateStep(currentStep, formData);
    setStepErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(COPY.form.fixErrors);
      return;
    }
    if (stepIndex < REGISTRATION_STEPS.length - 1) {
      setCurrentStep(REGISTRATION_STEPS[stepIndex + 1].key);
    }
  };

  const handlePrevious = () => {
    if (stepIndex > 0) {
      setStepErrors({});
      setCurrentStep(REGISTRATION_STEPS[stepIndex - 1].key);
    }
  };

  /** 422 field errors: shown on their inputs, and the form opens the step that has them. */
  const showServerFieldErrors = (fieldErrors: Record<string, string[]>, message: string) => {
    const errors: Record<string, string> = {};
    Object.entries(fieldErrors).forEach(([field, messages]) => {
      errors[field] = messages[0] ?? '';
    });
    setApiValidationErrors(errors);
    const hasDriverError = Object.keys(errors).some((key) => DRIVER_FIELDS.includes(key));
    setCurrentStep(hasDriverError && formData.role === 'driver' ? 'vehicle' : 'personal');
    toast.error(message);
  };

  const handleSubmit = async () => {
    if (inFlight.current || submitWait > 0) {
      return;
    }
    // Every step again: a step left with Previous may have been edited since its Next.
    const invalid = firstInvalidStep(formData);
    if (invalid) {
      setCurrentStep(invalid.step);
      setStepErrors(invalid.errors);
      toast.error(COPY.form.fixErrors);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setApiValidationErrors({});
    try {
      const result = await registerWithImages(buildRegistrationRequest(formData));

      if (registerUserWithImages.fulfilled.match(result)) {
        const outcome = result.payload;
        if (outcome.kind === 'verify_phone') {
          // BE-35/BE-38: the same answer for a new and a taken email; the code step decides.
          const role = outcome.role === 'driver' || outcome.role === 'passenger' ? outcome.role : formData.role;
          setPhoneStep({ pending: outcome.phoneVerification, role });
          if (outcome.message) {
            toast.success(outcome.message);
          }
          return;
        }
        // A backend from before BE-35: no phone step.
        toast.success(COPY.form.created);
        navigation.popTo('Login');
        return;
      }

      const payload = registerUserWithImages.rejected.match(result) ? result.payload : undefined;
      const message = rejectionMessage(payload, COPY.fallbacks.register);
      logger.debug('RegistrationScreen - registration refused', { kind: payload?.kind, status: payload?.status, code: payload?.code });
      if (payload?.kind === 'rate_limited') {
        holdSubmit(payload.retryAfter);
        toast.error(message);
      } else if (payload && Object.keys(payload.fieldErrors).length > 0) {
        showServerFieldErrors(payload.fieldErrors, message);
      } else {
        toast.error(message);
      }
    } catch (error: unknown) {
      logger.error('RegistrationScreen - registration error', error);
      toast.fromError(error, COPY.fallbacks.register);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'personal':
        return (
          <PersonalInfoStep
            data={formData}
            onDataChange={updateFormData}
            errors={stepErrors}
            apiErrors={apiValidationErrors}
            onClearApiError={clearApiError}
          />
        );
      case 'vehicle':
        return (
          <VehicleInfoStep
            data={formData}
            onDataChange={updateFormData}
            errors={stepErrors}
            apiErrors={apiValidationErrors}
            onClearApiError={clearApiError}
          />
        );
      case 'documents':
        return <DocumentsStep data={formData} onDataChange={updateFormData} errors={stepErrors} />;
      case 'review':
        return <ReviewStep data={formData} onDataChange={updateFormData} />;
      default:
        return null;
    }
  };

  const renderButtons = () => (
    <View style={styles.buttonContainerScrollable}>
      {stepIndex > 0 && (
        <TouchableOpacity style={styles.previousButton} onPress={handlePrevious} disabled={submitting}>
          <Icon name="arrow-back" size={20} color={BrandColors.primary} />
          <Text style={styles.previousButtonText}>{COPY.form.previous}</Text>
        </TouchableOpacity>
      )}
      {currentStep === 'review' ? (
        <TouchableOpacity
          style={[styles.submitButton, (submitting || submitWait > 0) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || submitWait > 0}
          accessibilityRole="button"
        >
          {submitting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={styles.submitButtonText.color} />
              <Text style={styles.submitButtonText}>{COPY.form.creating}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>
              {submitWait > 0 ? COPY.form.createIn(formatCountdown(submitWait)) : COPY.form.create}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} accessibilityRole="button">
          <Text style={styles.nextButtonText}>{COPY.form.next}</Text>
          <Icon name="arrow-forward" size={20} color={styles.nextButtonText.color} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primary} translucent={false} />
      <ImageBackground
        source={require('../../assets/images/background_raahe_haq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <RegistrationHeader
          title={phoneStep ? COPY.verify.headerTitle : COPY.form.title}
          subtitle={phoneStep ? COPY.verify.headerSubtitle : COPY.form.subtitle(formData.role)}
          stepIndex={phoneStep ? null : stepIndex}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {phoneStep ? (
              <RegistrationPhoneStep
                pending={phoneStep.pending}
                role={phoneStep.role}
                onGoToSignIn={() => navigation.popTo('Login')}
              />
            ) : (
              <>
                {renderStepContent()}
                {renderButtons()}
              </>
            )}
          </View>
        </ScrollView>
      </ImageBackground>
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}
