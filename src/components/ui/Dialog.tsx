import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Modal, PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { dialog, dialogStore, type DialogRequest } from '../../core/dialog';
import { t } from '../../i18n';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';
import { ModalRoot } from './ModalRoot';
import { useQueuedModal } from './modalQueue';

export type DialogAction = {
  label: string;
  onPress: () => void;
  /** `primary` (default for the first action), `destructive`, `secondary` or `ghost`. */
  variant?: ButtonVariant;
  loading?: boolean;
  testID?: string;
};

export type DialogSurfaceProps = {
  title: string;
  body?: string;
  /** Primary first. Stacked full width, or side by side when two short labels fit one line. */
  actions: DialogAction[];
  testID?: string;
};

const d = componentTokens.dialog;
/** Two labels this short (in characters, together) sit side by side; longer ones stack. */
const SIDE_BY_SIDE_MAX_CHARS = 20;
/** [UI-R3] Above this font scale the two buttons always stack (labels would not fit). */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.3;

/**
 * The dialog card (DESIGN_SYSTEM §5.15): width min(window − 48, 340), radius 16, padding 24,
 * `surfaceRaised`, elevation 4; title `h3`, body `bodySmall` `textSecondary` 8 below, actions 24
 * below as `md` pill buttons. Used by `Dialog` and shown inline in the kit gallery.
 */
export function DialogSurface({ title, body, actions, testID }: DialogSurfaceProps) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const sideBySide =
    actions.length === 2 &&
    actions.reduce((sum, a) => sum + a.label.length, 0) <= SIDE_BY_SIDE_MAX_CHARS &&
    PixelRatio.getFontScale() <= SIDE_BY_SIDE_MAX_FONT_SCALE;
  // Side by side: the primary sits at the end (reading order: cancel, then confirm).
  const ordered = sideBySide ? [...actions].reverse() : actions;
  return (
    <View
      testID={testID}
      accessibilityViewIsModal
      style={[
        styles.surface,
        theme.elevation[4],
        { width: Math.min(width - d.sideMargin * 2, d.maxWidth), backgroundColor: theme.colors.surfaceRaised },
        theme.mode === 'dark' ? { borderWidth: theme.borderWidth.thin, borderColor: theme.colors.border } : null,
      ]}
    >
      <AppText variant="h3" accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText variant="bodySmall" color="textSecondary" style={styles.body}>
          {body}
        </AppText>
      ) : null}
      <View style={[styles.actions, sideBySide ? styles.row : styles.stack]} testID={testID ? `${testID}-actions` : undefined}>
        {ordered.map((action, index) => (
          <View key={action.label} style={sideBySide ? styles.rowItem : null}>
            <Button
              label={action.label}
              onPress={action.onPress}
              size="md"
              variant={action.variant ?? (actions.indexOf(action) === 0 ? 'primary' : 'ghost')}
              loading={action.loading}
              testID={action.testID ?? (testID ? `${testID}-action-${index}` : undefined)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export type DialogProps = DialogSurfaceProps & {
  visible: boolean;
  /**
   * Render as an overlay in the current window instead of a new native Modal. Used inside a Modal
   * (ModalRoot), where iOS will not present a second Modal reliably.
   */
  inline?: boolean;
  /** Scrim tap and Android back; omit to make the dialog require an action. */
  onDismiss?: () => void;
};

/**
 * A themed modal dialog (§5.15) over the `overlay` scrim. For yes/no questions prefer the
 * promise API: `await confirm({ title, body, confirmLabel, destructive })` from
 * `src/core/dialog`, rendered by `DialogHost`.
 */
export function Dialog({ visible, onDismiss, inline = false, ...surface }: DialogProps) {
  const { theme } = useAppTheme();
  // [T-562] The root Dialog is a native Modal too: it takes its turn with the modal sheets.
  const modal = useQueuedModal(!inline && visible);
  // [T-568] While the Modal is hidden (fading out on iOS, or waiting for its turn) it keeps the
  // text and buttons it last showed: a new confirm() queued during the fade-out must not swap the
  // fading dialog's text. The new request's text appears when the Modal presents again.
  const shownSurface = useRef(surface);
  if (inline || modal.show) shownSurface.current = surface;
  const rendered = inline ? surface : shownSurface.current;
  // Android back answers "cancel" for the inline form too (a native Modal gets onRequestClose).
  useEffect(() => {
    if (!inline || !visible) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss?.();
      return true;
    });
    return () => sub.remove();
  }, [inline, onDismiss, visible]);

  const content = (
    <View style={[styles.scrim, { backgroundColor: theme.colors.overlay }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        disabled={!onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        importantForAccessibility="no"
        accessibilityElementsHidden
        testID={rendered.testID ? `${rendered.testID}-scrim` : undefined}
      />
      <DialogSurface {...rendered} />
    </View>
  );

  if (inline) {
    return visible ? <View style={StyleSheet.absoluteFill}>{content}</View> : null;
  }
  return (
    <Modal
      visible={modal.show}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss ?? (() => undefined)}
      onDismiss={modal.onDismiss}
    >
      <ModalRoot withDialogHost={false}>{content}</ModalRoot>
    </Modal>
  );
}

/**
 * Renders the queued `confirm()` / `alert()` requests one at a time. Mounted by
 * NotificationManager and by `ModalRoot` (inside native Modals); only the most recently mounted
 * host renders, so a dialog asked for while a Modal is up appears above that Modal. Screens never
 * mount it.
 */
export function DialogHost({ inline = false }: { inline?: boolean }) {
  const current = useSyncExternalStore(dialogStore.subscribe, dialogStore.getCurrent);
  const active = useSyncExternalStore(dialogStore.subscribe, dialogStore.getActiveHost);
  const [hostId, setHostId] = useState<number | null>(null);
  useEffect(() => {
    // Hosts inside a Modal (inline) outrank the root host.
    const host = dialogStore.registerHost(inline ? 1 : 0);
    setHostId(host.id);
    return host.unregister;
  }, [inline]);
  // [T-562] The last request stays rendered (hidden) after its answer, so the Dialog closes with
  // `visible={false}` and keeps its queue turn through the iOS fade-out instead of unmounting a
  // presented Modal. A queued next request reuses the same Modal.
  const last = useRef<DialogRequest | null>(null);
  if (current) last.current = current;
  const shown = current ?? last.current;
  if (!shown || hostId === null || active !== hostId) {
    return null;
  }
  const answer = (confirmed: boolean) => () => dialog.answer(shown.id, confirmed);
  const actions: DialogAction[] =
    shown.kind === 'alert'
      ? [{ label: shown.confirmLabel ?? t('common.done'), onPress: answer(true), testID: 'dialog-confirm' }]
      : [
          {
            label: shown.confirmLabel ?? t('common.done'),
            onPress: answer(true),
            variant: shown.destructive ? 'destructive' : 'primary',
            testID: 'dialog-confirm',
          },
          { label: shown.cancelLabel ?? t('common.cancel'), onPress: answer(false), variant: 'ghost', testID: 'dialog-cancel' },
        ];
  return (
    <Dialog
      visible={current !== null}
      title={shown.title}
      body={shown.body}
      actions={actions}
      onDismiss={answer(false)}
      inline={inline}
      testID="dialog"
    />
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surface: { borderRadius: radius.lg, padding: d.padding },
  body: { marginTop: space[2] },
  actions: { marginTop: space[6] },
  stack: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  rowItem: { flex: 1 },
});
