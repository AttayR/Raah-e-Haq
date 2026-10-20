import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { MAX_FONT_SIZE_MULTIPLIER, componentTokens, layout, space } from '../../../theme';
import { CHAT_BODY_MAX_LENGTH } from '../api';
import { CHAT_COPY } from '../copy';

type Props = {
  /** Returns false when nothing was sent (empty text); the draft is kept then. */
  onSend: (text: string) => boolean;
  /** Bottom padding (the safe-area inset while the keyboard is down). */
  bottomInset: number;
  /** "Message Bilal"; the generic placeholder when the name is not known. */
  placeholder?: string;
  /** Shown but not usable (the thread is still loading), so the layout does not jump. */
  disabled?: boolean;
  /** UI-R18: a support reply allows 2000 characters (BE-130 d); default the chat's 1000. */
  maxLength?: number;
  /** UI-R18: typing stays possible but Send is off (a 429 wait); the draft is kept. */
  sendBlocked?: boolean;
};

const k = componentTokens.chat;
/**
 * T-584: Send waits until the field has reported no keystroke for this long, so keystrokes still
 * queued behind the tap land in the message, not in the next draft. A person stops typing well
 * before tapping Send, so a normal tap goes out on the next frame.
 */
export const SEND_SETTLE_MS = 100;

/**
 * The message composer (T-510; UI-R14 shared-chat-thread): a `surface` bar with a top hairline,
 * a multiline field (radius 20, min 40, grows to five lines, `surfaceAlt` with the 1pt
 * `borderStrong` field boundary) and a 40 `primary` send button (0.4 while empty). 1000
 * characters at most (BE-13); a "{n}/1000" counter shows above the field from 900. The host's
 * keyboard avoider keeps the bar above the keyboard.
 */
export const ChatComposer: React.FC<Props> = ({ onSend, bottomInset, placeholder, disabled = false, maxLength = CHAT_BODY_MAX_LENGTH, sendBlocked = false }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState('');
  // T-581 (QA bug 8): the text as typed, read by Send. A tap that lands before the re-render for
  // the last keystroke used to meet a still-`disabled` button (or an older draft) and was lost;
  // the button now only dims while empty, and Send reads the latest text.
  const latest = useRef('');
  // T-584: when the field last reported text, and the field itself (a clear the native field
  // could refuse as older than its text is forced through `clear()`).
  const lastChangeAt = useRef(0);
  const inputRef = useRef<TextInput>(null);
  const [pressed, setPressed] = useState(false);
  const canSend = !disabled && !sendBlocked && draft.trim().length > 0;
  const lineHeight = theme.typography.body.lineHeight;
  // The counter shows for the last 10 % (900 of the chat's 1000).
  const counterFrom = Math.floor((maxLength * k.counterFrom) / CHAT_BODY_MAX_LENGTH);

  const onChangeText = useCallback((text: string) => {
    latest.current = text;
    lastChangeAt.current = Date.now();
    setDraft(text);
  }, []);

  const send = () => {
    const text = latest.current;
    if (disabled || sendBlocked || text.trim().length === 0) return;
    if (onSend(text)) {
      latest.current = '';
      setDraft('');
      inputRef.current?.clear();
    }
  };
  // The newest `send` for the deferred tap below (a re-render may have replaced it meanwhile).
  const sendRef = useRef(send);
  sendRef.current = send;

  // T-582 (QA 2026-10-19 bug 5): a tap is delivered ahead of keystrokes the field has already
  // shown but not yet reported (touches jump the event queue), so an immediate Send sent
  // "QA test" of "QA test one", and the clear was refused as older than the field's text. Send
  // waits one frame so those reports land first; more taps meanwhile send once. T-584 (QA
  // 2026-10-19 bug 2): one frame was not always enough ("QA test one" still sent "QA test"), so
  // it also waits until the field has been quiet for SEND_SETTLE_MS.
  const pendingFrame = useRef<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendWhenSettled = () => {
    const wait = SEND_SETTLE_MS - (Date.now() - lastChangeAt.current);
    if (wait > 0) {
      pendingTimer.current = setTimeout(sendWhenSettled, wait);
      return;
    }
    pendingTimer.current = null;
    sendRef.current();
  };
  const submit = () => {
    if (pendingFrame.current !== null || pendingTimer.current !== null) return;
    pendingFrame.current = requestAnimationFrame(() => {
      pendingFrame.current = null;
      sendWhenSettled();
    });
  };
  useEffect(
    () => () => {
      if (pendingFrame.current !== null) cancelAnimationFrame(pendingFrame.current);
      if (pendingTimer.current !== null) clearTimeout(pendingTimer.current);
    },
    [],
  );

  return (
    <View
      style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: space[2] + bottomInset }]}
      testID="chat-composer"
    >
      {draft.length >= counterFrom ? (
        <AppText
          variant="caption"
          color={draft.length >= maxLength ? 'danger' : 'textMuted'}
          style={styles.counter}
          testID="chat-counter"
        >
          {`${draft.length}/${maxLength}`}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={onChangeText}
          placeholder={placeholder ?? CHAT_COPY.composerPlaceholder}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={CHAT_COPY.composerA11y}
          multiline
          editable={!disabled}
          maxLength={maxLength}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={[
            styles.input,
            theme.typography.body,
            {
              color: c.textPrimary,
              backgroundColor: c.surfaceAlt,
              borderColor: c.borderStrong,
              borderWidth: theme.borderWidth.thin,
              maxHeight: lineHeight * k.composerMaxLines + space[2] * 2,
            },
          ]}
          testID="chat-input"
        />
        <Pressable
          onPress={submit}
          // Only while loading: an explicit `false` would override accessibilityState below.
          disabled={disabled || undefined}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          hitSlop={(layout.touchTargetIOS - k.sendButton) / 2}
          accessibilityRole="button"
          accessibilityLabel={CHAT_COPY.sendA11y}
          accessibilityState={{ disabled: !canSend }}
          style={[
            styles.send,
            { backgroundColor: pressed && canSend ? c.primaryPressed : c.primary },
            !canSend && styles.disabled,
          ]}
          testID="chat-send"
        >
          <Icon name="send" size={k.sendIconSize} color="onPrimary" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  counter: { alignSelf: 'flex-end', marginBottom: space[1] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  input: {
    flex: 1,
    minHeight: k.composerMinHeight,
    borderRadius: k.composerRadius,
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[2],
    textAlignVertical: 'center',
  },
  send: {
    width: k.sendButton,
    height: k.sendButton,
    borderRadius: k.sendButton / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
