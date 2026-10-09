/**
 * The error a step shows per field (T-201): the schema error from the last Next (the
 * screen's `errors`, cleared when the field changes), overridden by a blur check's error.
 * A blur check that passed ('') does not hide a Next error: only editing the field does.
 */
export function mergeStepErrors(
  fromNext: Partial<Record<string, string>> | undefined,
  fromBlur: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  Object.entries(fromNext ?? {}).forEach(([field, message]) => {
    if (message) merged[field] = message;
  });
  Object.entries(fromBlur).forEach(([field, message]) => {
    if (message) merged[field] = message;
  });
  return merged;
}
