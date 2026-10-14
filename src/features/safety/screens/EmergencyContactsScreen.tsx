import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  ListGroup,
  ListItem,
  Screen,
  SkeletonList,
  type HeaderAction,
} from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import { errorToastMessage } from '../../../core/toast/toast';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useEmergencyContacts } from '../contactsHooks';
import { EMERGENCY_CONTACT_EDITOR_ROUTE, type EmergencyContactsNavigator } from '../navigation';
import { formatPkPhone } from '../rules';
import type { EmergencyContact } from '../types';

/**
 * Account → Emergency contacts (T-520, BE-79), both roles: the people the SOS sheet texts, from
 * GET /me/emergency-contacts, with loading, error and empty states (the empty state says why)
 * and pull to refresh. Up to `max` (3): Add is hidden at the cap. Each row edits or deletes
 * (confirm, then an optimistic removal that comes back if the server refuses).
 */
export default function EmergencyContactsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<EmergencyContactsNavigator>();
  const isFocused = useIsFocused();
  const state = useEmergencyContacts(isFocused);
  const { contacts, max, refresh, reload, remove } = state;
  const loaded = state.data !== null;
  const full = max !== null && contacts.length >= max;

  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && state.status !== 'refreshing') setPulling(false);
  }, [pulling, state.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

  const openEditor = useCallback(
    (contact?: EmergencyContact) => navigation.navigate(EMERGENCY_CONTACT_EDITOR_ROUTE, { contactId: contact?.id }),
    [navigation],
  );

  const onDelete = useCallback(
    async (contact: EmergencyContact) => {
      const yes = await confirm({
        title: t('safety.contactDeleteTitle', { name: contact.name }),
        body: t('safety.contactDeleteBody'),
        confirmLabel: t('safety.contactDelete'),
        destructive: true,
      });
      if (!yes) return;
      try {
        await remove(contact);
        toast.success(t('safety.contactDeleted'));
      } catch (cause: unknown) {
        toast.error(errorToastMessage(cause, t('safety.contactDeleteFailed')) ?? t('safety.contactDeleteFailed'));
      }
    },
    [remove],
  );

  const addAction: HeaderAction = {
    icon: 'add',
    onPress: () => openEditor(),
    accessibilityLabel: t('safety.contactsAddA11y'),
    testID: 'emergency-contacts-add',
  };

  const renderBody = () => {
    if (!loaded && state.status === 'loading') return <SkeletonList rows={3} testID="emergency-contacts-loading" />;
    if (!loaded) {
      return (
        <ErrorState
          title={t('safety.contactsLoadFailed')}
          body={state.error ?? undefined}
          placement="center"
          retryLabel={t('safety.contactsRetry')}
          onRetry={reload}
          testID="emergency-contacts-error"
        />
      );
    }
    if (contacts.length === 0) {
      return (
        <EmptyState
          icon="contacts"
          placement="center"
          title={t('safety.contactsEmptyTitle')}
          body={t('safety.contactsEmptyBody')}
          action={{ label: t('safety.contactsAdd'), onPress: () => openEditor(), testID: 'emergency-contacts-empty-add' }}
          testID="emergency-contacts-empty"
        />
      );
    }
    return (
      <View style={styles.body}>
        <AppText variant="bodySmall" color="textSecondary">
          {t('safety.contactsIntro')}
        </AppText>
        {state.error ? (
          <AppText variant="bodySmall" color="danger" testID="emergency-contacts-refresh-error">
            {state.error}
          </AppText>
        ) : null}
        <ListGroup testID="emergency-contacts-list">
          {contacts.map((contact) => (
            <ListItem
              key={contact.id}
              variant="content"
              leading={<Avatar name={contact.name} size={40} />}
              title={contact.name}
              subtitle={formatPkPhone(contact.phone)}
              onPress={() => openEditor(contact)}
              accessibilityHint={t('safety.contactEditA11y', { name: contact.name })}
              trailing={
                <IconButton
                  icon="delete"
                  iconColor="danger"
                  onPress={() => onDelete(contact)}
                  accessibilityLabel={t('safety.contactDeleteA11y', { name: contact.name })}
                  testID={`emergency-contact-delete-${contact.id}`}
                />
              }
              testID={`emergency-contact-${contact.id}`}
            />
          ))}
        </ListGroup>
        {max !== null ? (
          <AppText variant="caption" color="textMuted" testID="emergency-contacts-count">
            {full ? t('safety.contactsFull', { max }) : t('safety.contactsCount', { count: contacts.length, max })}
          </AppText>
        ) : null}
        {full ? null : (
          <Button
            label={t('safety.contactsAdd')}
            variant="outline"
            leadingIcon="addContact"
            onPress={() => openEditor()}
            testID="emergency-contacts-add-button"
          />
        )}
      </View>
    );
  };

  return (
    <Screen testID="emergency-contacts-screen">
      <Header
        tone="background"
        title={t('safety.contactsTitle')}
        backLabel={t('safety.back')}
        onBack={() => navigation.goBack()}
        actions={loaded && !full ? [addAction] : undefined}
        testID="emergency-contacts"
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          loaded ? (
            <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
          ) : undefined
        }
      >
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[4] },
});
