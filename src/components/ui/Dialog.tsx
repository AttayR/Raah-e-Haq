import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Modal, PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { dialog, dialogStore, type DialogRequest } from '../../core/dialog';
import { t } from '../../i18n';
import { componentTokens, motion, radius, space } from '../../theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AppText } from './AppText';
import { Button, type ButtonVariant } from './Button';
import { timing } from './easing';
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
 * [T-571] The root Dialog's native Modal, faded in JS. With the native `fade` the Modal stayed
 * presented through UIKit's cross-dissolve and its dismiss transition, and the next taps on the
 * screen were lost for up to ~1 s after "Keep Ride" (QA 2026-10-18 bug 1). Now the Modal presents
 * and dismisses without a native animation: the scrim and card fade here, the Modal hides only
 * once they are invisible, and its (instant) dismiss is reported at once, so taps reach the screen
 * as soon as the dialog is gone. The queue turn is still held until `onDismiss`.
 *
 * A request that arrives during the fade-out waits for it to finish (the fading text never swaps,
 * T-568), then fades in on the same, still presented Modal.
 */
const ignoreRequestClose = () => undefined;

const useFadedModal = (want: boolean) => {
  // True from the render that shows this dialog until its fade-out has finished.
  const [open, setOpen] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const modal = useQueuedModal(want || open);
  // Set during render (not in an effect) so no render in between hides the Modal before the fade.
  if (modal.show && want && !open && !fadingOut) setOpen(true);
  if (open && !want && !fadingOut) setFadingOut(true);
  const showing = modal.show && want && !fadingOut;
  // The app's Reduce Motion reading (like Switch and BottomSheet): no fade, the dialog appears and goes at once.
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0);
  const endFadeOut = useCallback(() => {
    setFadingOut(false);
    setOpen(false);
  }, []);
  useEffect(() => {
    if (fadingOut && reduce) {
      opacity.value = 0;
      endFadeOut();
    } else if (fadingOut) {
      // Ends the fade even when interrupted: an invisible Modal must never stay up.
      opacity.value = withTiming(0, timing(motion.exit), () => {
        'worklet';
        runOnJS(endFadeOut)();
      });
    } else if (showing) {
      opacity.value = reduce ? 1 : withTiming(1, timing(motion.fast));
    }
  }, [endFadeOut, fadingOut, opacity, reduce, showing]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return { visible: modal.show, onDismiss: modal.onDismiss, showing, fadingOut, fadeStyle };
};

/**
 * A themed modal dialog (§5.15) over the `overlay` scrim. For yes/no questions prefer the
 * promise API: `await confirm({ title, body, confirmLabel, destructive })` from
 * `src/core/dialog`, rendered by `DialogHost`.
 */
export function Dialog({ visible, onDismiss, inline = false, ...surface }: DialogProps) {
  const { theme } = useAppTheme();
  // [T-562] The root Dialog is a native Modal too: it takes its turn with the modal sheets.
  const modal = useFadedModal(!inline && visible);
  // [T-568] While the Modal is fading out (or waiting for its turn) it keeps the text and buttons
  // it last showed: a new confirm() queued during the fade-out must not swap the fading dialog's
  // text. The new request's text appears when it fades in.
  const shownSurface = useRef(surface);
  if (inline || modal.showing) shownSurface.current = surface;
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
      visible={modal.visible}
      transparent
      animationType="none"
      statusBarTranslucent
      // [T-571] Android back during the fade-out does nothing: the dialog is answered, and
      // `onDismiss` would answer the next, still unseen confirm() queued behind it.
      onRequestClose={modal.fadingOut || !onDismiss ? ignoreRequestClose : onDismiss}
      onDismiss={modal.onDismiss}
    >
      <ModalRoot withDialogHost={false}>
        {/* A fading-out dialog takes no taps (its answer is given; a scrim tap must not re-answer). */}
        <Animated.View
          style={[styles.fill, modal.fadeStyle]}
          pointerEvents={modal.fadingOut ? 'none' : 'auto'}
          testID={rendered.testID ? `${rendered.testID}-fade` : undefined}
        >
          {content}
        </Animated.View>
      </ModalRoot>
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
  fill: { flex: 1 },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surface: { borderRadius: radius.lg, padding: d.padding },
  body: { marginTop: space[2] },
  actions: { marginTop: space[6] },
  stack: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2] },
  rowItem: { flex: 1 },
});
