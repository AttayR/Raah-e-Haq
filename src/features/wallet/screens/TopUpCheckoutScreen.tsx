import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import {
  useNavigation,
  useRoute,
  StackActions,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { ErrorState, Header, Screen } from '../../../components/ui';
import { t } from '../../../i18n';
import { TOP_UP_STATUS_ROUTE, type WalletRoutes } from '../navigation';
import { isAllowedCheckoutUrl, isTopUpReturnUrl } from '../topUpLinks';

/**
 * Deliberately every origin. react-native-webview hands any URL that fails `originWhitelist` to
 * `Linking.openURL` (the OS: dialer, SMS, Play Store, other apps) before
 * `onShouldStartLoadWithRequest` runs. With `*` nothing takes that path, and
 * `checkoutDecision` below is the only gate: it allows https (plus the local backend over
 * http in Debug) and stops at the app's return link; everything else is blocked in place.
 */
export const CHECKOUT_ORIGIN_WHITELIST: string[] = ['*'];

/**
 * What the checkout WebView does with a navigation: `finish` on the app's return link (the
 * server's `return_url` or `raahehaq://wallet/topup`), `load` for an allowed checkout page
 * (isAllowedCheckoutUrl), `block` for anything else. Nothing is ever handed to the OS.
 */
export const checkoutDecision = (
  url: string,
  returnUrl: string | null,
  dev: boolean = __DEV__,
): 'finish' | 'load' | 'block' => {
  if (isTopUpReturnUrl(url, returnUrl)) return 'finish';
  return isAllowedCheckoutUrl(url, dev) ? 'load' : 'block';
};

/**
 * The gateway's hosted checkout (T-515, BE-74 `next_action.redirect`) in an in-app browser.
 * Only https pages load (and the local backend in Debug); every other scheme is blocked and
 * never handed to the OS. The server ends the flow by redirecting to
 * `raahehaq://wallet/topup?id=…`; that navigation is caught here and the status screen takes over, which reads the real
 * result from GET /wallet/topups/{id}. Closing the page (X or Android back) also goes to the
 * status screen: the payment may still complete. No app token or cookie is shared with the page.
 */
export default function TopUpCheckoutScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { params } = useRoute<RouteProp<WalletRoutes, 'TopUpCheckout'>>();
  const { result, url, returnUrl, providerName } = params;
  const webView = useRef<WebView>(null);
  const finished = useRef(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    navigation.dispatch(
      StackActions.replace(TOP_UP_STATUS_ROUTE, {
        id: result.topUp.id,
        result,
        providerName,
      }),
    );
  }, [navigation, result, providerName]);

  // Defence in depth (AddMoney already checks): a page that is not allowed never loads.
  const allowed = isAllowedCheckoutUrl(url);
  useEffect(() => {
    if (!allowed) finish();
  }, [allowed, finish]);

  // Android back closes the page (to the status screen) instead of leaving the flow behind.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        finish();
        return true;
      },
    );
    return () => subscription.remove();
  }, [finish]);

  const onShouldStartLoadWithRequest = useCallback(
    (request: ShouldStartLoadRequest) => {
      const decision = checkoutDecision(request.url, returnUrl);
      if (decision === 'finish') finish();
      return decision === 'load';
    },
    [finish, returnUrl],
  );

  // Android may report the return link as a navigation without asking first.
  const onNavigationStateChange = useCallback(
    (state: WebViewNavigation) => {
      if (checkoutDecision(state.url, returnUrl) === 'finish') finish();
    },
    [finish, returnUrl],
  );

  return (
    <Screen testID="top-up-checkout-screen">
      <Header
        title={t('topUp.checkoutTitle')}
        backLabel={t('topUp.checkoutClose')}
        onBack={finish}
        tone="background"
        testID="top-up-checkout"
      />
      {failed ? (
        <ErrorState
          title={t('topUp.checkoutLoadFailed')}
          retryLabel={t('topUp.tryAgain')}
          onRetry={() => {
            setFailed(false);
            setLoading(true);
            webView.current?.reload();
          }}
          testID="top-up-checkout-error"
        />
      ) : null}
      <View style={[styles.fill, failed && styles.hidden]}>
        {allowed ? (
          <WebView
            ref={webView}
            source={{ uri: url }}
            originWhitelist={CHECKOUT_ORIGIN_WHITELIST}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavigationStateChange}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setLoading(false)}
            setSupportMultipleWindows={false}
            javaScriptCanOpenWindowsAutomatically={false}
            incognito
            allowsBackForwardNavigationGestures={false}
            style={[styles.fill, { backgroundColor: theme.colors.background }]}
            testID="top-up-checkout-webview"
          />
        ) : null}
        {loading ? (
          <View
            style={styles.loading}
            pointerEvents="none"
            testID="top-up-checkout-loading"
          >
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
