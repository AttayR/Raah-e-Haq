import type { LinkingOptions, PartialState, NavigationState } from '@react-navigation/native';
import { APP_URL_SCHEME, TOP_UP_RETURN_PATH, topUpIdFromPath } from '../../features/wallet/topUpLinks';
import { TOP_UP_STATUS_ROUTE } from '../../features/wallet/navigation';
import { resolveAuthRoute, type AuthRoute } from '../../core/auth/normalizeUser';
import type { RootStackParamList } from './RootNavigation';

/** Root stack route and its first (tabs) route per signed-in role. */
const ROLE_ROUTES = {
  passenger: { root: 'Passenger', tabs: 'PassengerTabs' },
  driver: { root: 'Driver', tabs: 'DriverTabs' },
} as const;

/**
 * Navigation state for `raahehaq://wallet/topup?id=…` (T-515): the signed-in role's top-up
 * status screen over its tabs. `route` is AuthFlow's resolveAuthRoute result, so the link is
 * routed only when the app actually shows an active passenger's or driver's stack; on splash,
 * the auth screens or account status (pending, suspended, …) it is ignored, as is every other
 * path.
 */
export const stateForPath = (
  path: string,
  route: AuthRoute,
): PartialState<NavigationState<RootStackParamList>> | undefined => {
  const id = topUpIdFromPath(path);
  if (!id || (route !== 'passenger' && route !== 'driver')) return undefined;
  const { root, tabs } = ROLE_ROUTES[route];
  return {
    routes: [
      {
        name: root,
        state: { index: 1, routes: [{ name: tabs }, { name: TOP_UP_STATUS_ROUTE, params: { id } }] },
      },
    ],
  };
};

/** The apiAuth fields AuthFlow routes on. */
export type AuthSnapshot = Parameters<typeof resolveAuthRoute>[0];

/**
 * React Navigation linking for the app's own URL scheme. Only the top-up return link is
 * handled (T-515); every other `raahehaq://` path is ignored. `getAuth` reads the store at the
 * time the link arrives and is resolved exactly as AuthFlow does.
 */
export const createLinking = (getAuth: () => AuthSnapshot): LinkingOptions<RootStackParamList> => ({
  prefixes: [`${APP_URL_SCHEME}://`],
  config: {
    screens: {
      Passenger: { initialRouteName: 'PassengerTabs', screens: { TopUpStatus: TOP_UP_RETURN_PATH } },
      Driver: { initialRouteName: 'DriverTabs', screens: { TopUpStatus: TOP_UP_RETURN_PATH } },
    },
  },
  getStateFromPath: (path) => stateForPath(path, resolveAuthRoute(getAuth())),
});
