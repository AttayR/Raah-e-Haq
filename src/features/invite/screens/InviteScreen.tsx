import React, { useCallback } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import type { RootState } from '../../../store';
import { Button, ErrorState, Header, PromoCard, Screen, Skeleton, SkeletonGroup, useIsOffline } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, layout, radius, space } from '../../../theme';
import { InviteCodeRow, InviteStatsStrip, InviteSteps } from '../components/InviteParts';
import { inviteCardText, inviteShareMessage, inviteSteps } from '../format';
import { useInviteCode, useInviteStats } from '../hooks';

/**
 * Invite friends, both roles (UI-R18, shared-support-invite §I2): the M5 invite card with the
 * code row (Copy + selectable text), "Share invite" (the text in the sender's language, the link
 * only when the server sends `share_url`), how it works in 2 or 3 steps, and "Your invites" once
 * someone joined. Reward amounts come only from the server's `programme`.
 */
export default function InviteScreen() {
  const navigation = useNavigation<{ goBack(): void }>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const userId = useSelector((s: RootState) => s.apiAuth.user?.id ?? null);
  const invite = useInviteCode(userId);
  const stats = useInviteStats();
  const shown = invite.shown;

  const onShare = useCallback(() => {
    if (!shown) return;
    Share.share({ message: inviteShareMessage(shown) }).catch(() => undefined);
  }, [shown]);

  const onRefresh = useCallback(() => {
    invite.refresh();
    stats.refresh();
  }, [invite, stats]);

  const programme = shown?.programme ?? null;
  const card = inviteCardText(programme);
  const how = inviteSteps(programme);
  const loading = !shown && invite.status === 'loading';
  const failed = !shown && invite.status === 'failed';
  const offline = useIsOffline();

  return (
    <Screen testID="invite-screen">
      <Header
        tone="background"
        title={t('invite.title')}
        backLabel={t('support.back')}
        onBack={() => navigation.goBack()}
        testID="invite-header"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + space[2], space[8]) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={invite.status === 'refreshing'}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        testID="invite-scroll"
      >
        {failed ? (
          <ErrorState
            title={t('invite.loadFailed')}
            kind={offline ? 'network' : 'server'}
            retryLabel={t('invite.tryAgain')}
            onRetry={invite.reload}
            testID="invite-error"
          />
        ) : (
          <View style={styles.block}>
            <PromoCard
              kind="invite"
              title={card.title}
              description={card.description}
              loading={!shown}
              childrenInteractive
              testID="invite-card"
            >
              {!shown ? (
                // 12 under the text lines, same as the code row it stands in for.
                <SkeletonGroup testID="invite-loading">
                  <Skeleton shape="block" height={componentTokens.invite.codeRowHeight} style={styles.codeSkeleton} />
                </SkeletonGroup>
              ) : (
                <InviteCodeRow code={shown.code} />
              )}
            </PromoCard>
            <Button
              label={t('invite.share')}
              size="lg"
              leadingIcon="share"
              onPress={onShare}
              disabled={!shown}
              accessibilityHint={loading ? t('invite.loadingA11y') : undefined}
              testID="invite-share"
            />
          </View>
        )}
        {!failed ? <InviteSteps steps={how.steps} expires={how.expires} /> : null}
        {stats.data && stats.data.joined > 0 ? <InviteStatsStrip stats={stats.data} currency={programme?.currency ?? null} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
    gap: layout.sectionGap,
  },
  block: { gap: space[4] },
  codeSkeleton: { borderRadius: radius.md, marginTop: space[3] - space[1] },
});
