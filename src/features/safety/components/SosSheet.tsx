import React, { useCallback } from 'react';
import { ActivityIndicator, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, BottomSheet, Button, Icon, ListGroup, ListItem, type IconName } from '../../../components/ui';
import { FALLBACK_EMERGENCY_NUMBERS, type EmergencyNumber } from '../../../config/safety';
import { confirm } from '../../../core/dialog';
import { haptics } from '../../../core/haptics';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { shareTripLink, telUrl, type LiveShare, type SosState } from '../hooks';
import { smsUrl } from '../rules';
import type { SosPosition, SosResult } from '../types';

export type SosSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Whose app this is: the confirm text names the other party, who is never told. */
  role: 'passenger' | 'driver';
  sos: SosState;
  /** The phone's position now, sent with the alert when known. */
  position: SosPosition | null;
  /** The passenger's live trip link (BE-80); null for the driver or once the ride is over. */
  share?: LiveShare | null;
  /** Opens Account → Emergency contacts; no button without it. */
  onAddContacts?: () => void;
};

const k = componentTokens.safety;

const NUMBER_ICONS: Record<string, IconName> = { police: 'police', rescue: 'ambulance' };

/** Dials an emergency number. No request is involved, so it works offline. */
export const dialEmergency = (number: string): void => {
  haptics.impactMedium();
  Linking.openURL(telUrl(number)).catch(() => toast.error(t('safety.callDeviceFailed')));
};

/** The SMS composer to every contact with the server's share message; else the share sheet. */
export const messageContacts = async (result: SosResult): Promise<void> => {
  const numbers = result.emergencyContacts.map((c) => c.phone);
  try {
    await Linking.openURL(smsUrl(numbers, result.shareMessage, Platform.OS));
  } catch {
    toast.info(t('safety.smsFailed'));
    await Share.share({ message: result.shareMessage }).catch(() => undefined);
  }
};

/**
 * The SOS sheet (T-520, BE-79), like Uber's safety toolkit: "Call Police 15" and "Call Rescue
 * 1122" first (plain tel: links, so they work offline and when the alert fails), then "Alert my
 * emergency contacts" (a confirm, then POST /rides/{id}/sos with the position, then the SMS
 * composer with the server's share message to the contacts) and, for the passenger, "Share
 * live trip". The alert is sent once per ride: tapping it again re-opens the messages only.
 * BE-87: "Women's safety alert" sends it as a women's-safety case (fast-tracked), or upgrades the
 * alert already sent.
 */
export function SosSheet({ visible, onClose, role, sos, position, share, onAddContacts }: SosSheetProps) {
  const { theme } = useAppTheme();
  const numbers: ReadonlyArray<EmergencyNumber> = sos.result?.emergencyNumbers ?? FALLBACK_EMERGENCY_NUMBERS;
  const sending = sos.status === 'sending';
  const noContacts = sos.result !== null && sos.result.emergencyContacts.length === 0;

  const alertContacts = useCallback(async () => {
    let result = sos.result;
    if (!result) {
      const yes = await confirm({
        title: t('safety.alertConfirmTitle'),
        body: t('safety.alertConfirmBody', { other: role === 'passenger' ? t('safety.otherDriver') : t('safety.otherPassenger') }),
        confirmLabel: t('safety.alertConfirm'),
        destructive: true,
      });
      if (!yes) return;
      result = await sos.send(position);
      if (!result) return;
    }
    if (result.emergencyContacts.length > 0) await messageContacts(result);
  }, [sos, role, position]);

  // BE-87: the same alert as a women's-safety case (or an upgrade of one already sent).
  const womenSent = sos.category === 'women_safety';
  const alertWomenSafety = useCallback(async () => {
    const yes = await confirm({
      title: t('safety.womenSafetyConfirmTitle'),
      body: t('safety.womenSafetyConfirmBody', { other: role === 'passenger' ? t('safety.otherDriver') : t('safety.otherPassenger') }),
      confirmLabel: t('safety.alertConfirm'),
      destructive: true,
    });
    if (!yes) return;
    const result = await sos.send(position, 'women_safety');
    if (result && result.emergencyContacts.length > 0) await messageContacts(result);
  }, [sos, role, position]);

  const shareAnotherWay = useCallback(() => {
    const message = sos.result?.shareMessage;
    if (message) Share.share({ message }).catch(() => undefined);
  }, [sos.result]);

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('safety.sosTitle')}
      testID="sos-sheet"
      header={
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.dangerSoft }]}>
            <Icon name="sos" size={k.sheetBadgeGlyph} color="danger" />
          </View>
          <AppText variant="h3" align="center" accessibilityRole="header">
            {t('safety.sosTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {t('safety.sosSubtitle')}
          </AppText>
        </View>
      }
      footer={<Button label={t('common.close')} variant="ghost" onPress={onClose} testID="sos-close" />}
    >
      <View style={styles.body} testID="sos-content">
        <View style={styles.calls}>
          {numbers.map((item) => (
            <Button
              key={item.key}
              label={t('safety.callNumber', { label: item.label, number: item.number })}
              accessibilityLabel={t('safety.callEmergencyA11y', { label: item.label, number: item.number })}
              variant="destructive"
              size="lg"
              leadingIcon={NUMBER_ICONS[item.key] ?? 'phone'}
              onPress={() => dialEmergency(item.number)}
              testID={`sos-call-${item.key}`}
            />
          ))}
        </View>

        <ListGroup>
          <ListItem
            icon="sms"
            title={sos.result ? t('safety.alertContactsAgain') : t('safety.alertContacts')}
            subtitle={sending ? t('safety.alertSending') : sos.status === 'sent' ? t('safety.alertSent') : t('safety.alertContactsBody')}
            onPress={sending ? undefined : alertContacts}
            disabled={sending}
            trailing={sending ? <ActivityIndicator color={theme.colors.primary} /> : undefined}
            chevron={!sending}
            testID="sos-alert-contacts"
          />
          <ListItem
            icon="womenMode"
            title={t('safety.womenSafety')}
            subtitle={womenSent ? t('safety.womenSafetySent') : t('safety.womenSafetyBody')}
            onPress={sending || womenSent ? undefined : alertWomenSafety}
            disabled={sending}
            chevron={!sending && !womenSent}
            testID="sos-women-safety"
          />
          {share ? (
            <ListItem
              icon="share"
              title={share.link ? t('safety.sharing') : t('safety.shareLive')}
              subtitle={t('safety.shareLiveBody')}
              onPress={share.busy ? undefined : share.link ? () => shareTripLink(share.link?.url ?? '') : share.start}
              disabled={share.busy}
              trailing={
                share.link ? (
                  <Button
                    label={t('safety.stopSharing')}
                    accessibilityLabel={t('safety.stopSharingA11y')}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={share.stop}
                    disabled={share.busy}
                    testID="sos-stop-sharing"
                  />
                ) : undefined
              }
              chevron={!share.link}
              testID="sos-share-trip"
            />
          ) : null}
        </ListGroup>

        {sos.error ? (
          <Banner tone="danger" text={sos.error} testID="sos-error" />
        ) : null}

        {noContacts ? (
          <Banner
            tone="info"
            icon="contacts"
            title={t('safety.noContactsTitle')}
            text={t('safety.noContactsBody')}
            action={onAddContacts ? { label: t('safety.addContacts'), onPress: onAddContacts, testID: 'sos-add-contacts' } : undefined}
            testID="sos-no-contacts"
          />
        ) : null}

        {sos.result?.shareMessage ? (
          <Button
            label={t('safety.shareAnotherWay')}
            variant="outline"
            leadingIcon="share"
            onPress={shareAnotherWay}
            testID="sos-share-another-way"
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Side padding like the other kit sheets (the sheet body itself has none).
  header: { alignItems: 'center', gap: space[2], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  badge: { width: k.sheetBadge, height: k.sheetBadge, borderRadius: k.sheetBadge / 2, alignItems: 'center', justifyContent: 'center' },
  body: { gap: space[4], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  calls: { gap: space[2] },
});
