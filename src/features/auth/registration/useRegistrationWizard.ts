import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScrollView, View } from 'react-native';
import { useApiAuth } from '../../../hooks/useApiAuth';
import { useOtpTimers } from '../../../hooks/useOtpTimers';
import { toast } from '../../../core/toast';
import { logger } from '../../../core/logging/logger';
import { rejectionMessage } from '../../../core/api/errors';
import { registerUserWithImages, type PendingPhoneVerification } from '../../../store/thunks/apiThunks';
import type { StepErrors } from '../../../schemas/registrationSchema';
import { space } from '../../../theme';
import { REGISTRATION_COPY as COPY } from '../copy/registration';
import { buildRegistrationRequest } from './buildRegistrationRequest';
import { firstInvalidPage, pageOfField, registrationPages, validatePage, type RegistrationPage } from './pages';
import {
  INITIAL_REGISTRATION_FORM,
  type RegistrationFormData,
  type RegistrationRole,
} from './registrationForm';
import { mapRegistrationServerErrors } from './serverFieldErrors';

/** Space kept above a field the form scrolls to after a 422 (the Header is outside the scroll). */
const FIELD_SCROLL_OFFSET = space[4];

/** What registration left for the phone step. In memory only: the token is a bearer secret. */
export interface PhoneStepState {
  pending: PendingPhoneVerification;
  role: RegistrationRole | null;
}

const FORM_KEYS = Object.keys(INITIAL_REGISTRATION_FORM) as (keyof RegistrationFormData)[];

/** Anything typed or picked besides the role (the leave guard asks only then). */
export const hasFormInput = (form: RegistrationFormData): boolean =>
  FORM_KEYS.some((key) => key !== 'role' && JSON.stringify(form[key]) !== JSON.stringify(INITIAL_REGISTRATION_FORM[key]));

/**
 * State and actions of the registration wizard (T-201/T-202, UI-R7): the page per role, the form,
 * schema errors from the last Continue, the last 422 per field and at form level, scrolling to the
 * first refused field, Create account (BE-35/BE-38 phone step, BE-53 429 hold) and the phone step.
 */
export function useRegistrationWizard(initialRole?: RegistrationRole) {
  const { registerWithImages } = useApiAuth();
  // BE-53: 429 rate_limited on register holds Create account for retry_after.
  const { resendIn: submitWait, blockResend: holdSubmit } = useOtpTimers();

  const [page, setPage] = useState<RegistrationPage>('role');
  const [roleChosen, setRoleChosen] = useState(initialRole !== undefined);
  const [submitting, setSubmitting] = useState(false);
  const [stepErrors, setStepErrors] = useState<StepErrors>({});
  // T-202: the last 422, per form input (cleared when the input changes) and form-level.
  const [serverErrors, setServerErrors] = useState<StepErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [scrollTarget, setScrollTarget] = useState<{ fields: string[] } | null>(null);
  const [formData, setFormData] = useState<RegistrationFormData>(() =>
    initialRole ? { ...INITIAL_REGISTRATION_FORM, role: initialRole } : INITIAL_REGISTRATION_FORM,
  );
  const [phoneStep, setPhoneStep] = useState<PhoneStepState | null>(null);
  /** A backend from before BE-35 created the account outright: leave for Login, unguarded. */
  const [finished, setFinished] = useState(false);
  // One registration at a time: a second tap lands before `submitting` re-renders the button.
  const inFlight = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // The form's container in the scroll content, to turn a field's position into a scroll offset.
  const containerRef = useRef<View>(null);
  const containerY = useRef(0);
  // Fields the steps wrap with <Anchored field=…>, and one stable ref callback per field.
  const anchors = useRef(new Map<string, View>());
  const anchorRefs = useRef(new Map<string, (node: View | null) => void>());

  const anchor = useCallback((field: string) => {
    let ref = anchorRefs.current.get(field);
    if (!ref) {
      ref = (node: View | null) => {
        if (node) anchors.current.set(field, node);
        else anchors.current.delete(field);
      };
      anchorRefs.current.set(field, ref);
    }
    return ref;
  }, []);

  // After a 422, or a Continue / Create account the schema refused (T-570: the "fix the
  // highlighted fields" toast must always point at a field in view), the page with the errors is
  // rendered; then scroll to the topmost errored field on it. A new object each time, so the same
  // field is scrolled to again after the user scrolled away.
  useEffect(() => {
    if (!scrollTarget) return undefined;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const nodes = scrollTarget.fields
        .map((field) => anchors.current.get(field))
        .filter((node): node is View => node !== undefined);
      Promise.all(
        nodes.map(
          (node) =>
            new Promise<number | null>((resolve) =>
              node.measureLayout(
                container,
                (_x, y) => resolve(y),
                () => resolve(null),
              ),
            ),
        ),
      ).then((ys) => {
        const measured = ys.filter((y): y is number => y !== null);
        if (cancelled || measured.length === 0) return;
        const offset = containerY.current + Math.min(...measured) - FIELD_SCROLL_OFFSET;
        scrollRef.current?.scrollTo({ y: Math.max(0, offset), animated: true });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [scrollTarget]);

  // A new page starts at the top (the 422 scroll above runs after this one).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const pages = registrationPages(formData.role);
  const pageIndex = pages.indexOf(page);

  // The latest form for updateFormData, which stays stable (steps list it in effect deps).
  const formRef = useRef(formData);
  formRef.current = formData;

  const updateFormData = useCallback((patch: Partial<RegistrationFormData>) => {
    if (patch.role !== undefined && patch.role !== formRef.current.role) {
      // The other role's form: the last 422 was about fields it may not have.
      setServerErrors({});
      setFormErrors([]);
    }
    formRef.current = { ...formRef.current, ...patch };
    setFormData((prev) => ({ ...prev, ...patch }));
    const edited = Object.keys(patch) as (keyof RegistrationFormData)[];
    const dropEdited = (prev: StepErrors) => {
      if (!edited.some((key) => prev[key])) return prev;
      const next = { ...prev };
      edited.forEach((key) => delete next[key]);
      return next;
    };
    // An edited field's errors are stale: the next Continue re-validates it, the next submit re-asks the server.
    setStepErrors(dropEdited);
    setServerErrors(dropEdited);
  }, []);

  const chooseRole = (role: RegistrationRole) => {
    setRoleChosen(true);
    updateFormData({ role });
  };

  const goTo = (next: RegistrationPage) => {
    setStepErrors({});
    setPage(next);
  };

  const handleNext = () => {
    if (page === 'role') {
      if (!roleChosen) {
        toast.error(COPY.form.chooseRoleFirst);
        return;
      }
      goTo(pages[1]);
      return;
    }
    const errors = validatePage(page, formData);
    setStepErrors(errors);
    const errored = Object.keys(errors);
    if (errored.length > 0) {
      setScrollTarget({ fields: errored });
      toast.error(COPY.form.fixErrors);
      return;
    }
    if (pageIndex < pages.length - 1) goTo(pages[pageIndex + 1]);
  };

  /**
   * Header back inside the wizard: the previous page, keeping every value. False on the first
   * page. While Create account is submitting it does nothing (true: handled, stay).
   */
  const handleBack = (): boolean => {
    if (submitting) return true;
    if (pageIndex <= 0) return false;
    goTo(pages[pageIndex - 1]);
    return true;
  };

  /**
   * 422 field errors (T-202): each under its input until that input changes; the form opens the
   * first page that has one and scrolls to its first errored field. Fields no input shows are
   * listed above the action bar. One toast sums it up.
   */
  const showServerFieldErrors = (fieldErrors: Record<string, string[]>) => {
    const mapped = mapRegistrationServerErrors(fieldErrors, formData.role);
    setServerErrors(mapped.fieldErrors);
    setFormErrors(mapped.formErrors);
    if (mapped.step && mapped.firstField) {
      setStepErrors({});
      setPage(pageOfField(mapped.step, mapped.firstField));
      setScrollTarget({ fields: [mapped.firstField] });
      toast.error(COPY.form.fixErrors);
    } else {
      toast.error(COPY.form.notAccepted);
    }
  };

  const handleSubmit = async () => {
    if (inFlight.current || submitWait > 0) return;
    // Every page again: a page left with Back may have been edited since its Continue.
    const invalid = firstInvalidPage(formData);
    if (invalid) {
      setPage(invalid.page);
      setStepErrors(invalid.errors);
      setScrollTarget({ fields: Object.keys(invalid.errors) });
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
          // T-567: no toast. Even one line sat over the code step's title and subtitle; the code
          // step confirms the registration inline (COPY.verify.received) instead.
          return;
        }
        // A backend from before BE-35: no phone step.
        toast.success(COPY.form.created);
        setFinished(true);
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

  return {
    page,
    pages,
    pageIndex,
    roleChosen,
    formData,
    /** Schema errors from the last Continue win over the last 422's message for the same input. */
    errors: { ...serverErrors, ...stepErrors } as StepErrors,
    formErrors,
    phoneStep,
    finished,
    submitting,
    submitWait,
    scrollRef,
    containerRef,
    containerY,
    anchor,
    updateFormData,
    chooseRole,
    goTo,
    handleNext,
    handleBack,
    handleSubmit,
  };
}
