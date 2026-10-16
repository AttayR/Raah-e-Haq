import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppDispatch } from '../../store';
import { isStaleSessionRejection, updateUserProfile } from '../../store/thunks/apiThunks';
import { t } from '../../i18n';
import type { User } from '../../services/api';
import {
  buildProfileUpdate,
  emailNeedsPassword,
  isProfileDirty,
  profileSaveErrors,
  toProfileForm,
  validateProfileForm,
  type ProfileErrors,
  type ProfileField,
  type ProfileForm,
} from './form';

/**
 * The Edit profile form's own state (T-504b): the values, field errors, one form-level line and
 * the saving flag. Nothing here touches the global auth status; a success replaces the
 * signed-in user (apiAuth matcher), so every screen that shows the profile follows.
 * The form starts from the profile once; a later store change does not overwrite typing.
 */
export function useProfileEditForm(user: User | null) {
  const dispatch = useAppDispatch();
  const [initial] = useState<ProfileForm>(() => toProfileForm(user));
  const [form, setForm] = useState<ProfileForm>(initial);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const setField = useCallback(<K extends ProfileField>(field: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field] && !(field === 'email' && prev.currentPassword)) return prev;
      const next = { ...prev };
      delete next[field];
      if (field === 'email') delete next.currentPassword;
      return next;
    });
    setFormError(null);
  }, []);

  const dirty = useMemo(() => isProfileDirty(form, initial), [form, initial]);
  const needsPassword = useMemo(() => emailNeedsPassword(form, initial, user), [form, initial, user]);

  /**
   * Checks, then PUT /profile with the changed fields. Resolves on success with the line to show:
   * the server's own after an email change (BE-38 "open the link we sent…"), else "Profile updated."
   */
  const save = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) return null;
    const issues = validateProfileForm(form, initial, user);
    setErrors(issues);
    setFormError(null);
    if (Object.keys(issues).length > 0) return null;
    inFlight.current = true;
    setSaving(true);
    try {
      const update = buildProfileUpdate(form, initial, user);
      const result = await dispatch(updateUserProfile(update));
      if (updateUserProfile.fulfilled.match(result)) {
        return (update.email !== undefined ? result.payload.message : null) ?? t('profileEdit.saved');
      }
      if (isStaleSessionRejection(result.payload)) return null;
      const refused = profileSaveErrors(result.payload);
      setErrors(refused.fields);
      setFormError(refused.form);
      return null;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [dispatch, form, initial, user]);

  return { form, setField, errors, formError, saving, dirty, needsPassword, save };
}
