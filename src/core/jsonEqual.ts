/**
 * Deep equality for JSON data (API resources): plain objects, arrays and primitives. Used to
 * keep the old object when a poll returns the same data (T-534, PERF-11), so selectors keep
 * their identity and screens do not re-render. Not for class instances, Dates, Maps or cycles.
 */
export const jsonEqual = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!jsonEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = Object.keys(ao);
  if (keys.length !== Object.keys(bo).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(bo, key) || !jsonEqual(ao[key], bo[key])) return false;
  }
  return true;
};
