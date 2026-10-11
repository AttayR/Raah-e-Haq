import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StatusBar,
  ImageBackground,
  type ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { mapRegistrationServerErrors } from '../../features/auth/registration/serverFieldErrors';
import { FieldAnchorContext } from '../../features/auth/registration/fieldAnchors';
import RegistrationPhoneStep from '../../features/auth/components/RegistrationPhoneStep';
import AuthKeyboardScroll from '../../features/auth/components/AuthKeyboardScroll';
import { REGISTRATION_COPY as COPY } from '../../features/auth/copy/registration';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';

/** How far above a field's error line the form scrolls, so its label and input show too. */
const FIELD_SCROLL_OFFSET = 120;

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
  // T-202: the last 422, per form input (cleared when the input changes) and form-level.
  const [serverErrors, setServerErrors] = useState<StepErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [scrollTarget, setScrollTarget] = useState<{ field: string } | null>(null);
  const [formData, setFormData] = useState<RegistrationFormData>(INITIAL_REGISTRATION_FORM);
  const [phoneStep, setPhoneStep] = useState<PhoneStepState | null>(null);
  // One registration at a time: a second tap lands before `submitting` re-renders the button.
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // The form's container and its offset in the scroll content, to turn a field's position into a scroll offset.
  const containerRef = useRef<View>(null);
  const containerY = useRef(0);
  // Error lines the steps mark with ref={anchor(field)}, and one stable ref callback per field.
  const anchors = useRef(new Map<string, View>());
  const anchorRefs = useRef(new Map<string, (node: View | null) => void>());

  const anchor = useCallback((field: string) => {
    let ref = anchorRefs.current.get(field);
    if (!ref) {
      ref = (node: View | null) => {
        if (node) {
          anchors.current.set(field, node);
        } else {
          anchors.current.delete(field);
        }
      };
      anchorRefs.current.set(field, ref);
    }
    return ref;
  }, []);

  // After a 422 the step that has the first error is rendered; then scroll to that field.
  useEffect(() => {
    if (!scrollTarget) return undefined;
    const frame = requestAnimationFrame(() => {
      const node = anchors.current.get(scrollTarget.field);
      const container = containerRef.current;
      if (!node || !container) return;
      node.measureLayout(container, (_x, y) => {
        const offset = containerY.current + y - FIELD_SCROLL_OFFSET;
        scrollRef.current?.scrollTo({ y: Math.max(0, offset), animated: true });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollTarget]);

  const stepIndex = REGISTRATION_STEPS.findIndex((step) => step.key === currentStep);

  const updateFormData = (patch: Partial<RegistrationFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    const edited = Object.keys(patch) as (keyof RegistrationFormData)[];
    const dropEdited = (prev: StepErrors) => {
      if (!edited.some((key) => prev[key])) return prev;
      const next = { ...prev };
      edited.forEach((key) => delete next[key]);
      return next;
    };
    // An edited field's errors are stale: the next Next re-validates it, the next submit re-asks the server.
    setStepErrors(dropEdited);
    setServerErrors(dropEdited);
    if (patch.role !== undefined && patch.role !== formData.role) {
      // The other role's form: the last 422 was about fields it may not have.
      setServerErrors({});
      setFormErrors([]);
    }
  };

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

  /**
   * 422 field errors (T-202): each under its input until that input changes; the form opens the
   * first step that has one and scrolls to its first errored field. Fields no input shows are
   * listed above the buttons. One toast sums it up.
   */
  const showServerFieldErrors = (fieldErrors: Record<string, string[]>) => {
    const mapped = mapRegistrationServerErrors(fieldErrors, formData.role);
    setServerErrors(mapped.fieldErrors);
    setFormErrors(mapped.formErrors);
    if (mapped.step && mapped.firstField) {
      setStepErrors({});
      setCurrentStep(mapped.step);
      setScrollTarget({ field: mapped.firstField });
      toast.error(COPY.form.fixErrors);
    } else {
      toast.error(COPY.form.notAccepted);
    }
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
    setServerErrors({});
    setFormErrors([]);
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
        showServerFieldErrors(payload.fieldErrors);
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
    // Schema errors from the last Next win over the last 422's message for the same input.
    const errors: StepErrors = { ...serverErrors, ...stepErrors };
    switch (currentStep) {
      case 'personal':
        return <PersonalInfoStep data={formData} onDataChange={updateFormData} errors={errors} />;
      case 'vehicle':
        return <VehicleInfoStep data={formData} onDataChange={updateFormData} errors={errors} />;
      case 'documents':
        return <DocumentsStep data={formData} onDataChange={updateFormData} errors={errors} />;
      case 'review':
        return <ReviewStep data={formData} onDataChange={updateFormData} />;
      default:
        return null;
    }
  };

  const renderFormErrors = () =>
    formErrors.length > 0 ? (
      <View style={styles.formErrorBox} accessibilityRole="alert">
        <Icon name="error" size={18} color={styles.formErrorText.color} />
        <View style={styles.formErrorList}>
          {formErrors.map((message) => (
            <Text key={message} style={styles.formErrorText}>
              {message}
            </Text>
          ))}
        </View>
      </View>
    ) : null;

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
    // Top edge only; the scroll content pads itself above the home indicator (T-204).
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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

        <AuthKeyboardScroll scrollRef={scrollRef} style={styles.scrollView}>
          <View
            ref={containerRef}
            style={styles.container}
            onLayout={(event) => {
              containerY.current = event.nativeEvent.layout.y;
            }}
          >
            {phoneStep ? (
              <RegistrationPhoneStep
                pending={phoneStep.pending}
                role={phoneStep.role}
                onGoToSignIn={() => navigation.popTo('Login')}
              />
            ) : (
              <FieldAnchorContext.Provider value={anchor}>
                {renderStepContent()}
                {renderFormErrors()}
                {renderButtons()}
              </FieldAnchorContext.Provider>
            )}
          </View>
        </AuthKeyboardScroll>
      </ImageBackground>
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}
