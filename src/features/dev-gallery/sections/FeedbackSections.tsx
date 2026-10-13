import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  Button,
  DialogSurface,
  EmptyState,
  ErrorState,
  SkeletonGroup,
  SkeletonListItem,
  SkeletonText,
  SkeletonCard,
  ToastView,
} from '../../../components/ui';
import { confirm } from '../../../core/dialog';
import type { ToastConfig, ToastType } from '../../../core/toast';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { GallerySection } from './GallerySection';

const noop = () => {};

const toastSamples: Array<[ToastType, string, boolean]> = [
  ['success', t('kitGallery.toastSuccess'), true],
  ['error', t('kitGallery.toastError'), false],
  ['info', t('kitGallery.toastInfo'), false],
  ['warning', t('kitGallery.toastWarning'), false],
  ['loading', t('kitGallery.toastLoading'), false],
];

const sampleToast = (type: ToastType, title: string, withAction: boolean): ToastConfig => ({
  id: `gallery-${type}`,
  type,
  title,
  duration: 0,
  action: withAction ? { label: t('kitGallery.toastAction'), onPress: noop } : undefined,
});

/** Banner tones + offline (§5.17) and the restyled Toast (§5.16) as static previews. */
export function FeedbackSection() {
  return (
    <GallerySection title={t('kitGallery.sectionFeedback')}>
      <Banner tone="info" icon="cash" title={t('kitGallery.bannerInfoTitle')} text={t('kitGallery.bannerInfo')} />
      <Banner tone="warning" text={t('kitGallery.bannerWarning')} action={{ label: t('kitGallery.bannerAction'), onPress: noop }} />
      <Banner tone="danger" text={t('kitGallery.bannerDanger')} />
      <Banner tone="success" text={t('kitGallery.bannerSuccess')} />
      <Banner tone="warning" icon="offline" text={t('kit.offline')} />
      <View style={styles.toasts}>
        {toastSamples.map(([type, title, withAction]) => (
          <ToastView key={type} preview config={sampleToast(type, title, withAction)} onHide={noop} />
        ))}
      </View>
    </GallerySection>
  );
}

/** Skeleton (§5.18), EmptyState (§5.19), ErrorState network + server (§5.20). */
export function StatesSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionStates')}>
      <SkeletonGroup style={[styles.panel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <SkeletonListItem />
        <SkeletonListItem leading="avatar" />
        <View style={styles.padded}>
          <SkeletonText lines={3} textVariant="bodySmall" />
          <SkeletonCard height={72} style={styles.cardGap} />
        </View>
      </SkeletonGroup>
      <View style={[styles.panel, { borderColor: theme.colors.border }]}>
        <EmptyState
          icon="rides"
          placement="center"
          title={t('kitGallery.emptyTitle')}
          body={t('kitGallery.emptyBody')}
          action={{ label: t('kitGallery.emptyAction'), onPress: noop }}
          testID="gallery-empty"
        />
      </View>
      <View style={[styles.panel, { borderColor: theme.colors.border }]}>
        <ErrorState
          kind="network"
          placement="center"
          title={t('kitGallery.errorNetworkTitle')}
          body={t('kitGallery.errorNetworkBody')}
          onRetry={noop}
          testID="gallery-error-network"
        />
      </View>
      <View style={[styles.panel, { borderColor: theme.colors.border }]}>
        <ErrorState
          placement="center"
          title={t('kitGallery.errorServerTitle')}
          body={t('kitGallery.errorServerBody')}
          onRetry={noop}
          retrying
          testID="gallery-error-server"
        />
      </View>
    </GallerySection>
  );
}

/** Dialog (§5.15): side-by-side and stacked layouts inline, plus a live confirm(). */
export function DialogSection() {
  const { theme } = useAppTheme();
  return (
    <GallerySection title={t('kitGallery.sectionDialog')}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.overlay }]}>
        <DialogSurface
          title={t('kitGallery.dialogSignOutTitle')}
          body={t('kitGallery.dialogSignOutBody')}
          actions={[
            { label: t('kitGallery.dialogSignOutConfirm'), onPress: noop, variant: 'destructive' },
            { label: t('common.cancel'), onPress: noop, variant: 'ghost' },
          ]}
        />
      </View>
      <View style={[styles.scrim, { backgroundColor: theme.colors.overlay }]}>
        <DialogSurface
          title={t('kitGallery.dialogDiscardTitle')}
          body={t('kitGallery.dialogDiscardBody')}
          actions={[
            { label: t('kitGallery.dialogDiscardConfirm'), onPress: noop, variant: 'destructive' },
            { label: t('kitGallery.dialogKeep'), onPress: noop, variant: 'ghost' },
          ]}
        />
      </View>
      <Button
        label={t('kitGallery.dialogOpen')}
        variant="secondary"
        onPress={() => {
          confirm({
            title: t('kitGallery.dialogSignOutTitle'),
            body: t('kitGallery.dialogSignOutBody'),
            confirmLabel: t('kitGallery.dialogSignOutConfirm'),
            destructive: true,
          });
        }}
        testID="gallery-dialog-open"
      />
      <AppText variant="caption" color="textMuted">
        confirm({'{'} title, body, confirmLabel, destructive {'}'}) → Promise&lt;boolean&gt;
      </AppText>
    </GallerySection>
  );
}

const styles = StyleSheet.create({
  toasts: { gap: space[2], marginTop: space[2] },
  panel: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  padded: { padding: space[4] },
  cardGap: { marginTop: space[3] },
  scrim: { alignItems: 'center', paddingVertical: space[6], borderRadius: radius.md },
});
