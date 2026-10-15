import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, ListGroup, ListItem, type BottomSheetHandle } from '../../../components/ui';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { PhotoSource } from '../picker';

/**
 * How long after the sheet's Modal is gone the picker opens. iOS cannot present the camera or
 * the photo picker while another modal is still being dismissed (the picker would not appear).
 */
export const PICKER_OPEN_DELAY_MS = 350;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has closed, with the row the user chose. */
  onPick: (source: PhotoSource) => void;
  /**
   * Shows "Remove photo" (BE-94 DELETE /profile/avatar, passengers with a photo only: drivers
   * must keep one). Called once the sheet has closed.
   */
  onRemove?: () => void;
};

type Choice = PhotoSource | 'remove';

/**
 * The profile photo action sheet (T-504): Take photo (front camera), Choose from library and,
 * when `onRemove` is given, Remove photo.
 */
export function PhotoSourceSheet({ visible, onClose, onPick, onRemove }: Props) {
  const sheet = useRef<BottomSheetHandle>(null);
  const chosen = useRef<Choice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const choose = (choice: Choice) => {
    chosen.current = choice;
    sheet.current?.close();
  };

  const closed = () => {
    const choice = chosen.current;
    chosen.current = null;
    onClose();
    if (choice) {
      timer.current = setTimeout(() => {
        timer.current = null;
        if (choice === 'remove') onRemove?.();
        else onPick(choice);
      }, PICKER_OPEN_DELAY_MS);
    }
  };

  return (
    <BottomSheet
      ref={sheet}
      mode="modal"
      visible={visible}
      onClose={closed}
      accessibilityLabel={t('profilePhoto.sheetTitle')}
      testID="photo-source-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" align="center" accessibilityRole="header">
            {t('profilePhoto.sheetTitle')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {t('profilePhoto.sheetSubtitle')}
          </AppText>
        </View>
      }
      footer={
        <Button label={t('common.cancel')} variant="ghost" onPress={() => sheet.current?.close()} testID="photo-source-cancel" />
      }
    >
      <ListGroup>
        <ListItem
          icon="camera"
          title={t('profilePhoto.takePhoto')}
          subtitle={t('profilePhoto.takePhotoSubtitle')}
          onPress={() => choose('camera')}
          chevron={false}
          testID="photo-source-camera"
        />
        <ListItem
          icon="photoLibrary"
          title={t('profilePhoto.chooseLibrary')}
          subtitle={t('profilePhoto.chooseLibrarySubtitle')}
          onPress={() => choose('library')}
          chevron={false}
          testID="photo-source-library"
        />
        {onRemove ? (
          <ListItem
            icon="delete"
            title={t('profilePhoto.remove')}
            subtitle={t('profilePhoto.removeSubtitle')}
            onPress={() => choose('remove')}
            chevron={false}
            destructive
            testID="photo-source-remove"
          />
        ) : null}
      </ListGroup>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[1], paddingHorizontal: space[4], paddingBottom: space[3] },
});
