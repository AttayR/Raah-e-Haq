import React, { useState } from 'react';
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
};

const k = componentTokens.chat;

/**
 * The message composer (T-510; UI-R14 shared-chat-thread): a `surface` bar with a top hairline,
 * a multiline field (radius 20, min 40, grows to five lines, `surfaceAlt` with the 1pt
 * `borderStrong` field boundary) and a 40 `primary` send button (0.4 while empty). 1000
 * characters at most (BE-13); a "{n}/1000" counter shows above the field from 900. The host's
 * keyboard avoider keeps the bar above the keyboard.
 */
export const ChatComposer: React.FC<Props> = ({ onSend, bottomInset, placeholder, disabled = false }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState('');
  const [pressed, setPressed] = useState(false);
  const canSend = !disabled && draft.trim().length > 0;
  const lineHeight = theme.typography.body.lineHeight;

  const submit = () => {
    if (onSend(draft)) setDraft('');
  };

  return (
    <View
      style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: space[2] + bottomInset }]}
      testID="chat-composer"
    >
      {draft.length >= k.counterFrom ? (
        <AppText
          variant="caption"
          color={draft.length >= CHAT_BODY_MAX_LENGTH ? 'danger' : 'textMuted'}
          style={styles.counter}
          testID="chat-counter"
        >
          {`${draft.length}/${CHAT_BODY_MAX_LENGTH}`}
        </AppText>
      ) : null}
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder ?? CHAT_COPY.composerPlaceholder}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={CHAT_COPY.composerA11y}
          multiline
          editable={!disabled}
          maxLength={CHAT_BODY_MAX_LENGTH}
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
          disabled={!canSend}
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
