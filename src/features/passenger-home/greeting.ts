/**
 * Passenger Home copy helpers (docs/design/screens/passenger-home.md, DESIGN_SYSTEM §7).
 */

/** First word of the name, or null when there is none. */
export const firstNameOf = (name?: string | null): string | null => {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first ? first : null;
};

/**
 * "Good morning|afternoon|evening, {first name}"; "Hello, {first name}" between 22:00 and
 * 05:00. Without a name the greeting stands alone.
 */
export const greetingFor = (date: Date, name?: string | null): string => {
  const h = date.getHours();
  const salutation =
    h >= 22 || h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = firstNameOf(name);
  return first ? `${salutation}, ${first}` : salutation;
};

/** A leading Google Plus Code ("G9C5+5F5, ..."), which riders cannot read as an address. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{0,3}\s*,?\s*/i;

/**
 * The street-level part of a reverse-geocoded address: a leading Plus Code is dropped
 * ("G9C5+5F5, Block N Gulberg III, Lahore" → "Block N Gulberg III, Lahore"). If nothing is
 * left the original text is kept.
 */
export const displayAddress = (address: string): string => {
  const trimmed = address.trim();
  const stripped = trimmed.replace(PLUS_CODE, '').trim();
  return stripped.length > 0 ? stripped : trimmed;
};
