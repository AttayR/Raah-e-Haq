/**
 * The app's return link from a hosted checkout (BE-74 `PAYMENTS_APP_RETURN_URL`):
 * `raahehaq://wallet/topup?id=<id>&status=<status>`. Only `id` is read: the status always comes
 * from GET /wallet/topups/{id}, so a forged link can only open a check of the caller's own top-up.
 */
export const APP_URL_SCHEME = 'raahehaq';
export const TOP_UP_RETURN_PATH = 'wallet/topup';
export const TOP_UP_RETURN_URL = `${APP_URL_SCHEME}://${TOP_UP_RETURN_PATH}`;

/** Top-up ids are opaque (`top_` + 26 chars); anything outside this shape is ignored. */
const TOP_UP_ID = /^[A-Za-z0-9_-]{1,64}$/;

const stripQuery = (url: string): string => url.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();

const queryParam = (url: string, name: string): string | null => {
  const query = url.split('#')[0].split('?')[1];
  if (!query) return null;
  for (const pair of query.split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (rawKey === name) {
      try {
        return decodeURIComponent(rawValue.replace(/\+/g, ' '));
      } catch {
        return null;
      }
    }
  }
  return null;
};

/** True when `url` is the checkout's return link (the server's `return_url`, or the app default). */
export const isTopUpReturnUrl = (url: string, returnUrl?: string | null): boolean => {
  const target = stripQuery(url);
  return target === stripQuery(TOP_UP_RETURN_URL) || (!!returnUrl && target === stripQuery(returnUrl));
};

/** The top-up id of a return link path ("wallet/topup?id=top_x&status=…", prefix removed); null otherwise. */
export const topUpIdFromPath = (path: string): string | null => {
  const clean = path.replace(/^\/+/, '');
  if (stripQuery(clean) !== TOP_UP_RETURN_PATH) return null;
  const id = queryParam(clean, 'id');
  return id && TOP_UP_ID.test(id) ? id : null;
};

/** The top-up id of a full return link URL; null for anything else. */
export const topUpIdFromUrl = (url: string): string | null => {
  const prefix = `${APP_URL_SCHEME}://`;
  return url.toLowerCase().startsWith(prefix) ? topUpIdFromPath(url.slice(prefix.length)) : null;
};

/** Dev-only hosts for the local fake gateway's checkout page (simulator, Android emulator). */
const DEV_HTTP_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

/**
 * True for a page the checkout may load: https anywhere; plain http only to the local backend
 * (localhost / 127.0.0.1 / 10.0.2.2) and only in a Debug build (`dev`), for the fake gateway.
 * Every other scheme (tel:, sms:, intent:, market:, app schemes, javascript:, data:, file:) is
 * refused.
 */
export const isAllowedCheckoutUrl = (url: string, dev: boolean = __DEV__): boolean => {
  if (/^https:\/\/[^/?#]+/i.test(url)) return true;
  if (!dev) return false;
  const host = /^http:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(url)?.[1]?.toLowerCase();
  return host !== undefined && DEV_HTTP_HOSTS.has(host);
};
