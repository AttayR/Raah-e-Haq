import React, { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon, ListGroup, ListItem } from '../../../components/ui';
import { FALLBACK_EMERGENCY_NUMBERS } from '../../../config/safety';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { formatPkPhone } from '../../safety/rules';
import { telUrl } from '../../safety/hooks';
import { phoneDigits } from '../format';
import type { SupportContacts } from '../types';

const open = (url: string, fallbackValue: string) => {
  Linking.openURL(url).catch(() => toast.info(t('support.openFailed', { value: fallbackValue })));
};

/** `mailto:` with only the generic subject: no personal data in the URL. */
export const supportMailUrl = (email: string): string =>
  `mailto:${email}?subject=${encodeURIComponent(t('support.emailSubject'))}`;

export const whatsappUrl = (number: string): string => `https://wa.me/${phoneDigits(number)}`;

/**
 * "Contact us" (shared-support-invite §H1.4): a row for each channel GET /settings/public sends
 * (phone, WhatsApp, email), and the support hours under the group when sent. Hidden when there
 * is nothing to show.
 */
export function HelpContactGroup({ contacts }: { contacts: SupportContacts }) {
  const { supportPhone, supportWhatsapp, supportEmail, supportHours } = contacts;
  if (!supportPhone && !supportWhatsapp && !supportEmail) return null;
  return (
    <View>
      <ListGroup title={t('support.contactOverline')} testID="support-contact">
        {supportPhone ? (
          <ListItem
            icon="phone"
            title={t('support.callSupport')}
            subtitle={formatPkPhone(supportPhone)}
            onPress={() => open(`tel:${phoneDigits(supportPhone)}`, supportPhone)}
            testID="support-contact-phone"
          />
        ) : null}
        {supportWhatsapp ? (
          <ListItem
            icon="chat"
            title={t('support.whatsapp')}
            subtitle={formatPkPhone(supportWhatsapp)}
            onPress={() => open(whatsappUrl(supportWhatsapp), supportWhatsapp)}
            testID="support-contact-whatsapp"
          />
        ) : null}
        {supportEmail ? (
          <ListItem
            icon="email"
            title={t('support.emailSupport')}
            subtitle={supportEmail}
            onPress={() => open(supportMailUrl(supportEmail), supportEmail)}
            testID="support-contact-email"
          />
        ) : null}
      </ListGroup>
      {supportHours ? (
        <AppText variant="caption" color="textSecondary" style={styles.hours} testID="support-contact-hours">
          {supportHours}
        </AppText>
      ) : null}
    </View>
  );
}

const police = FALLBACK_EMERGENCY_NUMBERS.find((n) => n.key === 'police')?.number ?? '15';

/**
 * The emergency row (§H1.5): always shown, always last. Police 15 dials directly (the OS call
 * sheet confirms on iOS); Rescue 1122 is named under it.
 */
export function HelpEmergencyGroup() {
  const { theme } = useAppTheme();
  const call = useCallback(() => {
    Linking.openURL(telUrl(police)).catch(() => toast.error(t('support.callFailed')));
  }, []);
  return (
    <ListGroup inset="tile" testID="support-emergency">
      <ListItem
        leading={
          <View style={[styles.tile, { backgroundColor: theme.colors.dangerSoft }]}>
            <Icon name="police" color="danger" />
          </View>
        }
        title={t('support.emergencyTitle')}
        subtitle={t('support.emergencySubtitle')}
        trailing={<Icon name="phone" size={space[5]} color="danger" />}
        onPress={call}
        accessibilityLabel={t('support.emergencyA11y')}
        testID="support-emergency-call"
      />
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  hours: { marginTop: space[2], marginHorizontal: space[4] },
  tile: {
    width: componentTokens.support.tile,
    height: componentTokens.support.tile,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
