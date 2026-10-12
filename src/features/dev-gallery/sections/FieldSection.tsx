import React, { useState } from 'react';
import { OtpInput, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { GallerySection } from './GallerySection';

/**
 * Text fields (DESIGN_SYSTEM §5.6) for UI-R2 design review. Part 1: default + helper, phone
 * (filled, then error), password. Part 2: search with clear, disabled, multiline, OTP (partial
 * and error). Every field is live, so focus, show/hide, clear and paste can be tried by hand.
 */
export function FieldSection({ part }: { part: 1 | 2 }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('3001234567');
  const [badPhone, setBadPhone] = useState('300');
  const [password, setPassword] = useState('secret-pass');
  const [search, setSearch] = useState('Liberty Market');
  const [notes, setNotes] = useState('');
  const [otp, setOtp] = useState('123');
  const [badOtp, setBadOtp] = useState('654321');

  return (
    <GallerySection title={`${t('kitGallery.sectionFields')} ${part}/2`}>
      {part === 1 ? (
        <>
          <TextField
            label={t('kitGallery.fieldName')}
            helper={t('kitGallery.fieldNameHelper')}
            value={name}
            onChangeText={setName}
            placeholder={t('kitGallery.fieldName')}
            testID="gallery-field-default"
          />
          <TextField
            variant="phone"
            label={t('kitGallery.fieldPhone')}
            value={phone}
            onChangeText={setPhone}
            testID="gallery-field-phone"
          />
          <TextField
            variant="phone"
            label={t('kitGallery.fieldPhone')}
            value={badPhone}
            onChangeText={setBadPhone}
            error={t('kitGallery.fieldPhoneError')}
            testID="gallery-field-phone-error"
          />
          <TextField
            variant="password"
            label={t('kitGallery.fieldPassword')}
            value={password}
            onChangeText={setPassword}
            testID="gallery-field-password"
          />
        </>
      ) : (
        <>
          <TextField
            variant="search"
            value={search}
            onChangeText={setSearch}
            placeholder={t('kit.searchPlaceholder')}
            accessibilityLabel={t('kit.searchPlaceholder')}
            testID="gallery-field-search"
          />
          <TextField
            label={t('kitGallery.fieldDisabled')}
            value={t('kitGallery.fieldDisabledValue')}
            onChangeText={setName}
            disabled
            testID="gallery-field-disabled"
          />
          <TextField
            label={t('kitGallery.fieldNotes')}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder={t('kitGallery.fieldNotes')}
            testID="gallery-field-multiline"
          />
          <OtpInput
            label={t('kitGallery.fieldOtp')}
            value={otp}
            onChange={setOtp}
            testID="gallery-otp"
          />
          <OtpInput
            label={t('kitGallery.fieldOtp')}
            value={badOtp}
            onChange={setBadOtp}
            error={t('kitGallery.fieldOtpError')}
            testID="gallery-otp-error"
          />
        </>
      )}
    </GallerySection>
  );
}
