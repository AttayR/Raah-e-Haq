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

/**
 * SEC-43: the gateways' hosted checkout hosts (BE-74 `config/payments.php` defaults). The server
 * starts on its own signed page (`/payments/checkout/{id}`), which posts on to one of these; a
 * start URL on a gateway host is accepted too, so a server that links straight to the gateway
 * still works. The sandbox hosts are accepted only in a Debug build.
 */
export const GATEWAY_CHECKOUT_HOSTS: readonly string[] = ['payments.jazzcash.com.pk', 'easypay.easypaisa.com.pk'];
export const SANDBOX_GATEWAY_CHECKOUT_HOSTS: readonly string[] = ['sandbox.jazzcash.com.pk', 'easypaystg.easypaisa.com.pk'];

interface WebUrl {
  scheme: string;
  host: string;
  /** The explicit port, or '' for the scheme's default. */
  port: string;
  path: string;
}

/** scheme://host[:port][/path] with no user info; null for anything else. Scheme and host lower-cased. */
const parseWebUrl = (url: string): WebUrl | null => {
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[^?#]*)?(?:[?#]|$)/i.exec(url);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const rawPort = match[3] ?? '';
  const defaultPort = (scheme === 'https' && rawPort === '443') || (scheme === 'http' && rawPort === '80');
  return { scheme, host: match[2].toLowerCase(), port: defaultPort ? '' : rawPort, path: match[4] ?? '/' };
};

/** The API's signed checkout page, `<API path>/payments/checkout/<top-up id>`, and nothing below it. */
const isCheckoutPath = (path: string, apiPath: string): boolean => {
  const prefix = `${apiPath.replace(/\/+$/, '')}/payments/checkout/`;
  return path.startsWith(prefix) && TOP_UP_ID.test(path.slice(prefix.length));
};

export interface CheckoutStartOptions {
  /** The REST API base URL (env.API_URL). */
  apiUrl: string;
  dev?: boolean;
}

/**
 * SEC-43: true when the checkout WebView may START on `url` (the server's `next_action.redirect`).
 * Only two shapes pass:
 * - the API's own signed checkout page on the API origin (scheme, host and port of env.API_URL).
 *   In a Debug build the local backend may also answer under another local name (localhost /
 *   127.0.0.1 / 10.0.2.2), because the backend's APP_URL and the app's API_URL can differ;
 * - an https page on a gateway checkout host (GATEWAY_CHECKOUT_HOSTS, plus the sandbox hosts in Debug).
 * Anything else, a look-alike https page included, never opens: the in-app view has no address
 * bar. Pages the checkout moves on to later (3-D Secure, bank pages) are checked by
 * isAllowedCheckoutUrl.
 */
export const isAllowedCheckoutStartUrl = (url: string, { apiUrl, dev = __DEV__ }: CheckoutStartOptions): boolean => {
  if (!isAllowedCheckoutUrl(url, dev)) return false;
  const target = parseWebUrl(url);
  const api = parseWebUrl(apiUrl);
  if (!target || !api) return false;
  if (isCheckoutPath(target.path, api.path)) {
    if (target.scheme === api.scheme && target.host === api.host && target.port === api.port) return true;
    if (dev && DEV_HTTP_HOSTS.has(target.host) && DEV_HTTP_HOSTS.has(api.host)) return true;
  }
  if (target.scheme !== 'https' || target.port !== '') return false;
  return GATEWAY_CHECKOUT_HOSTS.includes(target.host) || (dev && SANDBOX_GATEWAY_CHECKOUT_HOSTS.includes(target.host));
};

/** The host shown under the checkout title (SEC-43), so the user can see whose page it is. */
export const checkoutHostOf = (url: string): string | null => parseWebUrl(url)?.host ?? null;
