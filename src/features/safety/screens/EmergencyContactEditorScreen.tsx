import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AppText, Button, ErrorState, Header, Screen, SkeletonList, TextField } from '../../../components/ui';
import { MAX_EMERGENCY_CONTACTS } from '../../../config/safety';
import { toast } from '../../../core/toast';
import { t, type TranslationKey } from '../../../i18n';
import { layout, space } from '../../../theme';
import { contactSaveErrorsOf, saveEmergencyContact, useEmergencyContacts } from '../contactsHooks';
import type { EmergencyContactsNavigator, SafetyRoutes } from '../navigation';
import type { EmergencyContact } from '../types';
import {
  CONTACT_NAME_MAX,
  toE164,
  toFieldDigits,
  validateContactName,
  validateContactPhone,
  type ContactFieldError,
} from '../rules';

const FIELD_ERROR_KEYS: Record<ContactFieldError, TranslationKey> = {
  nameRequired: 'safety.nameRequired',
  nameShort: 'safety.nameShort',
  nameLetters: 'safety.nameLetters',
  phoneRequired: 'safety.phoneRequired',
  phoneInvalid: 'safety.phoneInvalid',
};

const fieldText = (error: ContactFieldError | null): string | null => (error ? t(FIELD_ERROR_KEYS[error]) : null);

/**
 * Add or edit one emergency contact (T-520, BE-79): a name (letters, 2-60) and a Pakistani
 * mobile on the kit phone field (+92 prefix, digits keypad). Only the contact id comes in the
 * route; the contact itself is read from GET /me/emergency-contacts (no PII in navigation
 * state). Both fields are checked here first; the server's 422 field errors (duplicate, own
 * number) show under the field, the cap (EMERGENCY_CONTACTS_LIMIT) as one line. Saving POSTs a
 * new contact or PUTs the edit.
 */
export default function EmergencyContactEditorScreen() {
  const navigation = useNavigation<EmergencyContactsNavigator>();
  const route = useRoute<RouteProp<SafetyRoutes, 'EmergencyContactEditor'>>();
  const contactId = route.params?.contactId ?? null;
  const list = useEmergencyContacts(true);
  const max = list.max ?? MAX_EMERGENCY_CONTACTS;
  const editing = contactId === null ? null : list.contacts.find(c => c.id === contactId) ?? null;
  const loading = contactId !== null && list.data === null && list.status === 'loading';
  const missing = contactId !== null && !loading && editing === null;

  let body: React.ReactNode;
  if (loading) {
    body = <SkeletonList rows={2} testID="emergency-contact-loading" />;
  } else if (missing) {
    body = (
      <ErrorState
        title={t('safety.contactsLoadFailed')}
        body={list.error ?? undefined}
        placement="center"
        retryLabel={t('safety.contactsRetry')}
        onRetry={list.reload}
        testID="emergency-contact-missing"
      />
    );
  } else {
    body = <ContactForm key={editing?.id ?? 'new'} editing={editing} max={max} onSaved={() => navigation.goBack()} />;
  }

  return (
    <Screen testID="emergency-contact-editor" keyboardAvoiding>
      <Header
        tone="background"
        title={t(contactId !== null ? 'safety.contactEditTitle' : 'safety.contactAddTitle')}
        backLabel={t('safety.back')}
        onBack={() => navigation.goBack()}
        testID="emergency-contact-editor-header"
      />
      {body}
    </Screen>
  );
}

function ContactForm({ editing, max, onSaved }: { editing: EmergencyContact | null; max: number; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [digits, setDigits] = useState(editing ? toFieldDigits(editing.phone) : '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const onSave = async () => {
    if (inFlight.current) return;
    const nameIssue = fieldText(validateContactName(name));
    const phoneIssue = fieldText(validateContactPhone(digits));
    setNameError(nameIssue);
    setPhoneError(phoneIssue);
    setFormError(null);
    if (nameIssue || phoneIssue) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await saveEmergencyContact({ name: name.trim(), phone: toE164(digits) }, editing);
      toast.success(t('safety.contactSaved'));
      onSaved();
    } catch (cause: unknown) {
      const errors = contactSaveErrorsOf(cause, max);
      setNameError(errors.name);
      setPhoneError(errors.phone);
      setFormError(errors.form);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
    >
      <TextField
        label={t('safety.contactName')}
        placeholder={t('safety.contactNamePlaceholder')}
        value={name}
        onChangeText={text => {
          setName(text);
          setNameError(null);
        }}
        maxLength={CONTACT_NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        error={nameError}
        testID="emergency-contact-name"
      />
      <TextField
        variant="phone"
        label={t('safety.contactPhone')}
        helper={t('safety.contactPhoneHelper')}
        value={digits}
        onChangeText={text => {
          setDigits(text);
          setPhoneError(null);
        }}
        error={phoneError}
        testID="emergency-contact-phone"
      />
      {formError ? (
        <AppText variant="bodySmall" color="danger" accessibilityRole="alert" testID="emergency-contact-error">
          {formError}
        </AppText>
      ) : null}
      <Button
        label={t('safety.contactSave')}
        onPress={onSave}
        loading={saving}
        haptic="impactLight"
        testID="emergency-contact-save"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[3],
    paddingBottom: space[8],
    gap: space[5],
  },
});
