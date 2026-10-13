import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, BottomSheet, Button, ListItem, MapControls, Radio, TextField } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};
/** Frame standing in for a full-screen map so the sheet's snaps are visible in the gallery. */
const MAP_FRAME_HEIGHT = 560;
const REASONS = [t('kitGallery.reasonFar'), t('kitGallery.reasonPlans'), t('kitGallery.reasonMistake')];

/**
 * BottomSheet (§5.14, §8.3) in map mode inside a map-sized frame (peek 170 + half + full, drag
 * the handle) with MapControls riding above it, and a modal sheet (scrim, content height) with
 * a field that sends it to `full` when the keyboard opens.
 */
export function SheetSection() {
  const { theme } = useAppTheme();
  const sheetHeight = useSharedValue(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [atFull, setAtFull] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  return (
    <GallerySection title={t('kitGallery.sectionSheet')}>
      <View
        style={[styles.map, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border }]}
        testID="gallery-sheet-frame"
      >
        <MapControls onBack={noop} onLocate={noop} sheetHeight={sheetHeight} hidden={atFull} testID="gallery-map-controls" />
        <BottomSheet
          peekHeight={170}
          animatedHeight={sheetHeight}
          onSnapChange={snap => setAtFull(snap === 'full')}
          header={
            <View style={styles.sheetHeader}>
              <AppText variant="title">{t('kitGallery.sheetTitle')}</AppText>
              <AppText variant="bodySmall" color="textSecondary">
                {t('kitGallery.sheetBody')}
              </AppText>
            </View>
          }
          footer={<Button label={t('kitGallery.sheetFooter')} size="lg" onPress={noop} />}
          testID="gallery-sheet"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <ListItem key={i} title={t('kitGallery.sheetRow', { n: i + 1 })} icon="bookmark" onPress={noop} />
          ))}
        </BottomSheet>
      </View>
      <Button label={t('kitGallery.sheetOpenModal')} variant="secondary" onPress={() => setModalOpen(true)} testID="gallery-sheet-open" />
      <BottomSheet
        mode="modal"
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        header={
          <View style={styles.sheetHeader}>
            <AppText variant="h3">{t('kitGallery.sheetModalTitle')}</AppText>
            <AppText variant="bodySmall" color="textSecondary">
              {t('kitGallery.sheetModalBody')}
            </AppText>
          </View>
        }
        footer={<Button label={t('common.done')} onPress={() => setModalOpen(false)} />}
        testID="gallery-modal-sheet"
      >
        <View style={styles.modalBody}>
          {REASONS.map(r => (
            <Radio key={r} label={r} selected={reason === r} onSelect={() => setReason(r)} />
          ))}
          <TextField label={t('kitGallery.fieldNotes')} value={note} onChangeText={setNote} />
        </View>
      </BottomSheet>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  map: { height: MAP_FRAME_HEIGHT, borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  sheetHeader: { paddingHorizontal: space[4], paddingBottom: space[3], gap: space[1] },
  modalBody: { paddingHorizontal: space[4], gap: space[2] },
});
