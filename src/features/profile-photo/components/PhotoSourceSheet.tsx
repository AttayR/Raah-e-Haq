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
};

/**
 * The profile photo action sheet (T-504): Take photo (front camera) or Choose from library.
 * There is no "Remove photo" row: the server has no endpoint that removes a profile photo.
 */
export function PhotoSourceSheet({ visible, onClose, onPick }: Props) {
  const sheet = useRef<BottomSheetHandle>(null);
  const chosen = useRef<PhotoSource | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const choose = (source: PhotoSource) => {
    chosen.current = source;
    sheet.current?.close();
  };

  const closed = () => {
    const source = chosen.current;
    chosen.current = null;
    onClose();
    if (source) {
      timer.current = setTimeout(() => {
        timer.current = null;
        onPick(source);
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
      </ListGroup>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: space[1], paddingHorizontal: space[4], paddingBottom: space[3] },
});
