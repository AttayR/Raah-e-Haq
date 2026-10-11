import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { IconButton } from '../../../components/ui';
import { MAX_FONT_SIZE_MULTIPLIER, radius, space } from '../../../theme';
import { CHAT_BODY_MAX_LENGTH } from '../api';
import { CHAT_COPY } from '../copy';

type Props = {
  /** Returns false when nothing was sent (empty text); the draft is kept then. */
  onSend: (text: string) => boolean;
  /** Bottom padding (the safe-area inset while the keyboard is down). */
  bottomInset: number;
};

/** The message input (T-510): grows to a few lines, 1000 characters at most (BE-13). */
export const ChatComposer: React.FC<Props> = ({ onSend, bottomInset }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;

  const submit = () => {
    if (onSend(draft)) setDraft('');
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.surface, borderTopColor: c.border, paddingBottom: space[2] + bottomInset },
      ]}
      testID="chat-composer"
    >
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={CHAT_COPY.composerPlaceholder}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={CHAT_COPY.composerA11y}
        multiline
        maxLength={CHAT_BODY_MAX_LENGTH}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[
          styles.input,
          theme.typography.body,
          { color: c.textPrimary, backgroundColor: c.surfaceAlt, borderColor: c.border },
        ]}
        testID="chat-input"
      />
      <IconButton
        icon="send"
        onPress={submit}
        disabled={!canSend}
        variant={canSend ? 'tonal' : 'plain'}
        iconColor={canSend ? 'primaryText' : 'textMuted'}
        accessibilityLabel={CHAT_COPY.sendA11y}
        size={44}
        testID="chat-send"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 132,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[3],
    paddingTop: space[2] + 2,
    paddingBottom: space[2] + 2,
    textAlignVertical: 'center',
  },
});
