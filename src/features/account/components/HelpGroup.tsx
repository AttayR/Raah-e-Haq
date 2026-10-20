import React, { useCallback } from 'react';
import { I18nManager, Linking, StyleSheet, View } from 'react-native';
import { Icon, ListGroup, ListItem } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import { useSupportContacts } from '../../support/hooks';
import type { AccountNavigator } from '../navigation';

type Props = { navigation: AccountNavigator; prefix: string };

/**
 * "Help" (shared-settings §6, UI-R18): Help & support and Invite friends always; Terms of service
 * and Privacy policy only when GET /settings/public sends an `https:` link (read once per session,
 * shared with Help), opening in the browser with the external-link glyph instead of a chevron.
 * The Invite row is neutral (grey tile, no saffron).
 */
export function HelpGroup({ navigation, prefix }: Props) {
  const { contacts } = useSupportContacts();
  const openLink = useCallback((url: string) => {
    Linking.openURL(url).catch(() => toast.error(t('account.linkFailed')));
  }, []);
  const external = (
    <View style={I18nManager.isRTL ? styles.flip : null}>
      <Icon name="externalLink" size={space[5]} color="textMuted" />
    </View>
  );
  const { termsUrl, privacyUrl } = contacts;
  return (
    <ListGroup title={t('account.groupHelp')} testID={`${prefix}-group-help`}>
      <ListItem icon="support" title={t('account.help')} onPress={() => navigation.navigate('Support')} testID={`${prefix}-help`} />
      <ListItem icon="gift" title={t('account.invite')} onPress={() => navigation.navigate('Invite')} testID={`${prefix}-invite`} />
      {termsUrl ? (
        <ListItem
          icon="document"
          title={t('account.terms')}
          trailing={external}
          accessibilityHint={t('account.opensBrowserHint')}
          onPress={() => openLink(termsUrl)}
          testID={`${prefix}-terms`}
        />
      ) : null}
      {privacyUrl ? (
        <ListItem
          icon="lock"
          title={t('account.privacy')}
          trailing={external}
          accessibilityHint={t('account.opensBrowserHint')}
          onPress={() => openLink(privacyUrl)}
          testID={`${prefix}-privacy`}
        />
      ) : null}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
});
