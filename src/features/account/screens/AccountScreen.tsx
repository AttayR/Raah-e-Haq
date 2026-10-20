import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useAppDispatch, type RootState } from '../../../store';
import { getUserProfile } from '../../../store/thunks/apiThunks';
import { useLogout } from '../../../hooks/useLogout';
import { useTabScrollReset } from '../../../hooks/useTabScrollReset';
import { AppText, Header, ListGroup, ListItem, OfflineBanner, Screen, useHeaderScroll } from '../../../components/ui';
import { ProfileSummaryCard } from '../../../components/account/ProfileSummaryCard';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { AccountChecks } from '../../profile-edit';
import { peekMyStats } from '../../stats/hooks';
import { SafetyGroup, YourAccountGroup } from '../components/AccountRoleRows';
import { AppearanceRow, LanguageRow } from '../components/PreferenceRows';
import { HelpGroup } from '../components/HelpGroup';
import { versionLine } from '../rules';
import type { AccountNavigator, AccountRole } from '../navigation';

/**
 * Account tab, one anatomy for both roles (UI-R16, shared-settings.md): profile card, account
 * checks, "Your account" (per-role rows), "Safety", "Preferences" (Notifications, Appearance and
 * Language as value rows with one radio sheet), Sign out on its own and the version line. Same
 * group order and names on both roles; only the rows of §4 differ. Everything renders from the
 * stored user: no request on focus, pull to refresh re-reads GET /auth/profile.
 *
 * UI-R18: the "Help" group (Help & support, Invite friends, and Terms / Privacy once GET
 * /settings/public sends their links) sits between Preferences and Sign out.
 */
export function AccountScreen({ role }: { role: AccountRole }) {
  const prefix = `${role}-settings`;
  const navigation = useNavigation<AccountNavigator>();
  const dispatch = useAppDispatch();
  const { theme } = useAppTheme();
  const user = useSelector((state: RootState) => state.apiAuth.user);
  const { confirmLogout, isLoggingOut } = useLogout();
  const [refreshing, setRefreshing] = useState(false);
  const { scrollY, onScroll } = useHeaderScroll();
  const scrollRef = useRef<Animated.ScrollView>(null);
  useTabScrollReset(scrollRef);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await dispatch(getUserProfile());
      if (getUserProfile.rejected.match(result)) toast.error(t('account.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  // M2 rating star (DESIGN_SYSTEM §1.8): GET /me/stats when another screen read it in the last
  // minute (no request from this tab, §13), else the profile's own rating.
  const statsRating = peekMyStats()?.rating;

  const openProfile = useCallback(() => navigation.navigate('Profile'), [navigation]);

  return (
    <Screen testID={prefix}>
      <Header variant="large" inlineTitle title={t('nav.account')} scrollY={scrollY} tone="background" testID={`${prefix}-header`} />
      <OfflineBanner style={styles.offline} testID={`${prefix}-offline`} />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID={`${prefix}-scroll`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <View style={styles.cardBlock}>
          <ProfileSummaryCard user={user} rating={statsRating} onPress={openProfile} testID={`${prefix}-profile`} />
          <AccountChecks user={user} phoneOnly onOpenPhone={() => navigation.navigate('ChangePhone')} testID={`${prefix}-checks`} />
        </View>

        <YourAccountGroup role={role} user={user} navigation={navigation} prefix={prefix} />
        <SafetyGroup role={role} user={user} navigation={navigation} prefix={prefix} />

        <ListGroup title={t('account.groupPreferences')} testID={`${prefix}-group-preferences`}>
          <ListItem
            icon="bell"
            title={t('account.notifications')}
            onPress={() => navigation.navigate('NotificationPreferences')}
            testID={`${prefix}-notifications`}
          />
          <AppearanceRow />
          <LanguageRow />
        </ListGroup>

        <HelpGroup navigation={navigation} prefix={prefix} />

        <ListGroup>
          <ListItem
            icon="logout"
            title={isLoggingOut ? t('account.signingOut') : t('account.signOut')}
            destructive
            onPress={confirmLogout}
            disabled={isLoggingOut}
            testID={`${prefix}-sign-out`}
          />
        </ListGroup>

        <AppText variant="caption" color="textMuted" align="center" style={styles.footer} testID={`${prefix}-version`}>
          {versionLine()}
        </AppText>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  offline: { marginHorizontal: layout.gutter, marginBottom: space[2] },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: layout.sectionGap,
  },
  cardBlock: { gap: space[3] },
  // 16 below the sign-out group (the section gap is 24).
  footer: { marginTop: space[4] - layout.sectionGap },
});
