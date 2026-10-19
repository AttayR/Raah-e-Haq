import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Header, Illustration, Screen, type IconName } from '../../components/ui';
import { componentTokens, layout, space } from '../../theme';
import { t } from '../../i18n';
import { primerCanSkip, type PrimerKind } from './primer';

export type PrimerRole = 'passenger' | 'driver';

type PrimerContent = { title: string; body: string; icon: IconName; badge: IconName };

/** Copy and art per kind; notifications differ per role (ride updates vs ride requests). */
const contentFor = (kind: PrimerKind, role: PrimerRole): PrimerContent => {
  switch (kind) {
    case 'locationPassenger':
      return {
        title: t('permissions.locationPassengerTitle'),
        body: t('permissions.locationPassengerBody'),
        icon: 'map',
        badge: 'pin',
      };
    case 'locationDriver':
      return {
        title: t('permissions.locationDriverTitle'),
        body: t('permissions.locationDriverBody'),
        icon: 'map',
        badge: 'carMarker',
      };
    case 'notifications':
    default:
      return role === 'driver'
        ? {
            title: t('permissions.notificationsDriverTitle'),
            body: t('permissions.notificationsDriverBody'),
            icon: 'bellRing',
            badge: 'carMarker',
          }
        : {
            title: t('permissions.notificationsPassengerTitle'),
            body: t('permissions.notificationsPassengerBody'),
            icon: 'bellRing',
            badge: 'carMarker',
          };
  }
};

export type PermissionPrimerScreenProps = {
  kind: PrimerKind;
  role: PrimerRole;
  onContinue: () => void;
  onNotNow: () => void;
};

/**
 * Permission pre-prompt page (UI-R8, shared-permissions): illustration, `h1` title and one short
 * reason, centred between the header and the bottom actions; "Continue" (lg primary) goes on to
 * the OS prompt, "Not now" (lg ghost) skips it.
 * Driver location has no "Not now". The middle scrolls, so 1.3x text on an SE never clips.
 */
export function PermissionPrimerScreen({ kind, role, onContinue, onNotNow }: PermissionPrimerScreenProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // §3.2: 8 above the home indicator, at least 16 from the edge without one.
  const actionsBottom = insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset;
  const compact = height < componentTokens.auth.compactWindowHeight;
  const content = contentFor(kind, role);
  const canSkip = primerCanSkip(kind);
  return (
    <Screen edges={['top', 'bottom']} testID={`permission-primer-${kind}`}>
      {/* Empty bar (no actions): one skip action per page, the bottom ghost button (UI-R8 review). */}
      <Header tone="background" />
      <ScrollView contentContainerStyle={styles.middle} showsVerticalScrollIndicator={false}>
        <Illustration icon={content.icon} badge={{ icon: content.badge }} size={compact ? 'compact' : 'regular'} />
        <AppText variant="h1" align="center" accessibilityRole="header" style={styles.title}>
          {content.title}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={styles.body}>
          {content.body}
        </AppText>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: actionsBottom }]}>
        <Button
          label={t('permissions.continue')}
          onPress={onContinue}
          size="lg"
          accessibilityHint={t('permissions.continueHint')}
          testID="permission-primer-continue"
        />
        {canSkip ? (
          <Button
            label={t('permissions.notNow')}
            onPress={onNotNow}
            variant="ghost"
            size="lg"
            testID="permission-primer-not-now"
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  middle: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[6], paddingVertical: space[6] },
  title: { marginTop: space[6], maxWidth: componentTokens.illustration.textMaxWidth },
  body: { marginTop: space[2], maxWidth: componentTokens.illustration.textMaxWidth },
  actions: { paddingHorizontal: layout.gutter, paddingTop: space[4], gap: space[2] },
});
