import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, Badge, Banner, Button, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import type { User } from '../../../services/api';
import { space } from '../../../theme';
import { PROFILE_PHOTO_SIZE, useProfilePhoto } from '../useProfilePhoto';
import { PhotoSourceSheet } from './PhotoSourceSheet';

const SIZE = PROFILE_PHOTO_SIZE;
const BADGE = 32;

type Props = {
  name: string;
  /** The current photo (the signed-in user's `profile_image_url`). */
  uri?: string | null;
  /** After the server accepted the photo (the store already holds the new profile). */
  onUploaded?: (user: User) => void;
  /** Offer "Remove photo" when there is a photo (passengers only; drivers must keep one, BE-94). */
  canRemove?: boolean;
  /** `uri` is the driver's new photo waiting for review (BE-94): label it "Under review". */
  underReview?: boolean;
  /** Toast the server's `message` after an upload (drivers: "submitted for review"). */
  useServerMessage?: boolean;
  testID?: string;
};

/**
 * The tappable profile avatar of the passenger and driver Profile screens (T-504): Avatar 96 with
 * a camera badge; tapping opens Take photo / Choose from library. While the photo uploads the
 * picked photo shows under a progress scrim with a Cancel; a failure puts the current photo
 * back and offers Retry. Passengers can also remove the photo; a driver's photo waiting for review
 * carries an "Under review" label (BE-94).
 */
export function ProfilePhotoEditor({
  name,
  uri,
  onUploaded,
  canRemove = false,
  underReview = false,
  useServerMessage = false,
  testID = 'profile-photo',
}: Props) {
  const { theme } = useAppTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state, choose, cancel, retry, remove } = useProfilePhoto({ onUploaded, useServerMessage });
  const uploading = state.phase === 'uploading';
  const busy = uploading || state.phase === 'removing';
  const percent = Math.round(state.progress * 100);
  const hasPhoto = !!uri && uri.trim().length > 0;
  const circle = { width: SIZE, height: SIZE, borderRadius: SIZE / 2 };

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        onPress={() => setSheetOpen(true)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? t('profilePhoto.change') : t('profilePhoto.add')}
        accessibilityHint={underReview && !uploading ? t('profilePhoto.underReviewA11y') : undefined}
        accessibilityState={{ disabled: busy, busy }}
        hitSlop={space[2]}
        testID={`${testID}-button`}
      >
        <Avatar name={name} uri={state.previewUri ?? uri} size={SIZE} testID={`${testID}-avatar`} />
        {busy ? (
          <View
            style={[styles.scrim, circle, { backgroundColor: theme.colors.overlay }]}
            accessibilityLiveRegion="polite"
            testID={`${testID}-progress`}
          >
            <ActivityIndicator color={theme.colors.onPrimary} />
            {uploading ? (
              <AppText variant="caption" color="onPrimary">
                {state.progress > 0 ? `${percent}%` : t('profilePhoto.uploadingShort')}
              </AppText>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.badge,
              { backgroundColor: theme.colors.primary, borderColor: theme.colors.background, borderWidth: theme.borderWidth.focus },
            ]}
            testID={`${testID}-badge`}
          >
            <Icon name="camera" size={16} color="onPrimary" />
          </View>
        )}
      </Pressable>

      {underReview && hasPhoto && !busy ? (
        <Badge tone="info" label={t('profilePhoto.underReview')} testID={`${testID}-under-review`} />
      ) : null}

      {uploading ? (
        <Button
          label={t('profilePhoto.cancelUpload')}
          variant="ghost"
          size="sm"
          onPress={cancel}
          accessibilityLabel={t('profilePhoto.uploading', { percent })}
          testID={`${testID}-cancel`}
        />
      ) : null}

      {state.phase === 'failed' && state.error ? (
        <Banner
          tone="danger"
          title={t('profilePhoto.failedTitle')}
          text={state.error}
          action={{ label: t('profilePhoto.retry'), onPress: retry, testID: `${testID}-retry` }}
          style={styles.banner}
          testID={`${testID}-error`}
        />
      ) : null}

      <PhotoSourceSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onPick={choose}
        onRemove={canRemove && hasPhoto ? remove : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: space[2], alignSelf: 'stretch' },
  scrim: { position: 'absolute', top: 0, start: 0, alignItems: 'center', justifyContent: 'center', gap: space[1] },
  badge: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: { alignSelf: 'stretch' },
});
