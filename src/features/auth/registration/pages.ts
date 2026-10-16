import { firstInvalidStep, validateStep, type StepErrors } from '../../../schemas/registrationSchema';
import type { RegistrationFormData, RegistrationRole, RegistrationStep } from './registrationForm';

/**
 * The wizard's pages per role (UI-R7, spec auth-registration). A page shows part of one schema
 * step (registrationSchema keeps its four steps): the driver's `vehicle` step is shown as two
 * pages, "Vehicle & licence" and "Payout" (the bank fields). The role page is not a schema step
 * and is not counted in "Step n of m". Passengers never see vehicle, documents-for-drivers or
 * payout pages.
 */
export type RegistrationPage = 'role' | 'personal' | 'vehicle' | 'documents' | 'payout' | 'review';

type FormField = keyof RegistrationFormData;

/** The bank fields of the `vehicle` schema step, shown on the driver's Payout page. */
export const PAYOUT_FIELDS: readonly FormField[] = ['bankName', 'bankBranch', 'bankAccountNumber'];

const PASSENGER_PAGES: readonly RegistrationPage[] = ['role', 'personal', 'documents', 'review'];
const DRIVER_PAGES: readonly RegistrationPage[] = ['role', 'personal', 'vehicle', 'documents', 'payout', 'review'];

export const registrationPages = (role: RegistrationRole): readonly RegistrationPage[] =>
  role === 'driver' ? DRIVER_PAGES : PASSENGER_PAGES;

/** The schema step a page validates (null for the role page). */
export const schemaStepOf = (page: RegistrationPage): RegistrationStep | null => {
  if (page === 'role') return null;
  if (page === 'payout') return 'vehicle';
  return page;
};

const isPayoutField = (field: string): boolean => (PAYOUT_FIELDS as readonly string[]).includes(field);

/** The page that shows `field` of schema step `step`. */
export const pageOfField = (step: RegistrationStep, field: string): RegistrationPage =>
  step === 'vehicle' && isPayoutField(field) ? 'payout' : step;

/** Only the errors of the fields a page shows (the vehicle step is split over two pages). */
export const pageErrors = (page: RegistrationPage, errors: StepErrors): StepErrors => {
  if (page !== 'vehicle' && page !== 'payout') return errors;
  const wantPayout = page === 'payout';
  const kept: StepErrors = {};
  (Object.keys(errors) as FormField[]).forEach((field) => {
    if (isPayoutField(field) === wantPayout && errors[field]) kept[field] = errors[field];
  });
  return kept;
};

/** The schema errors of one page, keyed like StepErrors; empty when the page may be left. */
export const validatePage = (page: RegistrationPage, data: RegistrationFormData): StepErrors => {
  const step = schemaStepOf(page);
  return step ? pageErrors(page, validateStep(step, data)) : {};
};

/**
 * The first page (in on-screen order) that shows one of `errors` of schema step `step`. Used
 * after a 422 and after the full re-check before Create account.
 */
export const pageForStepErrors = (
  step: RegistrationStep,
  errors: StepErrors,
  role: RegistrationRole,
): RegistrationPage => {
  const owning = new Set(Object.keys(errors).map((field) => pageOfField(step, field)));
  return registrationPages(role).find((page) => owning.has(page)) ?? step;
};

/** Before submit: the first page that has errors, with that page's errors; null when all pass. */
export const firstInvalidPage = (
  data: RegistrationFormData,
): { page: RegistrationPage; errors: StepErrors } | null => {
  const invalid = firstInvalidStep(data);
  if (!invalid) return null;
  const page = pageForStepErrors(invalid.step, invalid.errors, data.role);
  return { page, errors: pageErrors(page, invalid.errors) };
};

/** "Step n of m" for a page; null on the role page (not counted). */
export const pageProgress = (
  page: RegistrationPage,
  role: RegistrationRole,
): { current: number; total: number } | null => {
  const pages = registrationPages(role);
  const index = pages.indexOf(page);
  if (index <= 0) return null;
  return { current: index, total: pages.length - 1 };
};
