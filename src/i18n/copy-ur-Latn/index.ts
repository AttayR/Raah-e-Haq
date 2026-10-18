import { registerAuthCopy } from './auth';
import { registerRideCopy } from './rides';
import { registerAccountCopy } from './account';

/**
 * Roman Urdu translations of the feature copy objects (T-523), registered once when this module
 * is first imported (LanguageGate imports it at startup). `en.ts` strings are translated in
 * `../ur-Latn.ts`; these cover the `FOO_COPY` objects the screens read directly.
 */
registerAuthCopy();
registerRideCopy();
registerAccountCopy();
