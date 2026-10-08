import React from 'react';
import { ActivityIndicator, Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import type { User } from '../../../services/api';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { Typography } from '../../../theme/typography';
import { useLogout } from '../../../hooks/useLogout';
import { ACCOUNT_STATUS_COPY } from '../copy/accountStatus';
import { accountStatusView } from '../accountStatus';
import { useCheckAccountStatus } from '../hooks/useCheckAccountStatus';
import { useRejectedDocuments } from '../hooks/useRejectedDocuments';
import AccountStatusCard from '../components/AccountStatusCard';
import RejectedDocumentsList from '../components/RejectedDocumentsList';
import { ON_PRIMARY, RADIUS, SPACING } from '../components/accountStatusStyles';

type AccountStatusState = { apiAuth: { user: User | null; statusUnverified: boolean } };

/** If AuthFlow ever renders this without a user: treat it as "status unknown" (sign out works). */
const NO_USER: Pick<User, 'role' | 'status' | 'rejection_reason' | 'name'> = {
  role: null,
  status: 'inactive',
  rejection_reason: null,
  name: '',
};

/**
 * Account status (T-106, AUTH-01, DRV-12): AuthFlow shows it for any signed-in user who is not
 * active, or active without a role this app serves. It reads only apiAuth (never Firebase);
 * copy per role and status comes from features/auth/copy/accountStatus.
 * - Check Status: GET /auth/profile; AuthFlow routes home once the account is active.
 * - Pending drivers: rejected documents/vehicles with their reason and a re-upload.
 * - Sign Out: the single logout (T-102), which clears the local session even when
 *   /auth/logout answers 403 for a blocked account.
 */
export default function AccountStatusScreen() {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const user = useSelector((state: AccountStatusState) => state.apiAuth.user) ?? NO_USER;
  const statusUnverified = useSelector((state: AccountStatusState) => state.apiAuth.statusUnverified);
  const view = accountStatusView(user, statusUnverified || user === NO_USER);

  const { confirmLogout, isLoggingOut } = useLogout();
  const { check, checking, error } = useCheckAccountStatus(user);
  const documents = useRejectedDocuments(view.showRejectedDocuments);

  const onCheckStatus = async () => {
    const routable = await check();
    // Routable: AuthFlow is unmounting this screen, so the list is not reloaded.
    if (!routable && view.showRejectedDocuments) {
      documents.reload();
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.logoRing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Image source={require('../../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
            {view.heading}
          </Text>
          <Text style={[styles.name, { color: colors.mutedText }]} numberOfLines={1}>
            {user.name || ACCOUNT_STATUS_COPY.fallbackName}
          </Text>
        </View>

        <AccountStatusCard view={view} colors={colors} />

        {/* Actions first, so a long rejected-items list never pushes them off screen. */}
        <View style={styles.actions}>
          {error ? (
            <Text testID="account-status-check-error" style={[styles.error, { color: colors.text }]}>
              {error}
            </Text>
          ) : null}
          {view.canCheckStatus ? (
            <TouchableOpacity
              testID="account-status-check"
              accessibilityRole="button"
              accessibilityState={{ disabled: checking || isLoggingOut, busy: checking }}
              disabled={checking || isLoggingOut}
              onPress={onCheckStatus}
              style={[styles.primaryButton, { backgroundColor: colors.primary }, checking && styles.dimmed]}
            >
              {checking ? <ActivityIndicator color={ON_PRIMARY} /> : <Icon name="refresh" size={20} color={ON_PRIMARY} />}
              <Text style={[styles.primaryText, { color: ON_PRIMARY }]}>
                {checking ? ACCOUNT_STATUS_COPY.checking : ACCOUNT_STATUS_COPY.checkStatus}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            testID="account-status-sign-out"
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoggingOut, busy: isLoggingOut }}
            disabled={isLoggingOut}
            onPress={confirmLogout}
            style={[styles.secondaryButton, { borderColor: colors.accent, backgroundColor: colors.surface }]}
          >
            <Icon name="logout" size={20} color={colors.accent} />
            <Text style={[styles.secondaryText, { color: colors.accent }]}>
              {isLoggingOut ? ACCOUNT_STATUS_COPY.signingOut : ACCOUNT_STATUS_COPY.signOut}
            </Text>
          </TouchableOpacity>
        </View>

        {view.showRejectedDocuments ? (
          <RejectedDocumentsList
            items={documents.items}
            loading={documents.loading}
            error={documents.error}
            uploadingKey={documents.uploadingKey}
            colors={colors}
            onRetry={documents.reload}
            onReuploadDocument={documents.reuploadDocument}
            onReuploadVehicle={documents.reuploadVehicle}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl - SPACING.xs,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.xl,
    gap: SPACING.xl,
  },
  header: {
    alignItems: 'center',
  },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    width: 44,
    height: 44,
  },
  heading: {
    ...Typography.display,
    textAlign: 'center',
  },
  name: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  actions: {
    gap: SPACING.md,
  },
  error: {
    ...Typography.subtitle,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  primaryText: {
    ...Typography.button,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 2,
  },
  secondaryText: {
    ...Typography.button,
  },
  dimmed: {
    opacity: 0.7,
  },
});
