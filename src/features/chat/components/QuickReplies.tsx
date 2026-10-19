import React, { useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { CHAT_COPY } from '../copy';
import type { ChatRole } from '../types';

type Props = {
  /** The viewer's role: each side gets its own three replies. */
  role: ChatRole;
  /** Sends the reply at once (the same path as the composer); false when nothing was sent. */
  onSend: (text: string) => boolean;
};

/**
 * Quick replies (UI-R14, shared-chat-thread §4): one horizontal line of action Chips above the
 * composer while the chat is open and the thread is empty or the last message is theirs.
 * Tapping one sends it immediately; a second tap before the row steps aside (the reply is now
 * the last message, so the host hides it) is ignored, so a double tap never sends twice. Copy is
 * static per role (CHAT_COPY, Roman Urdu too).
 */
export function QuickReplies({ role, onSend }: Props) {
  const inFlight = useRef(false);
  const pick = (reply: string) => {
    if (inFlight.current) return;
    inFlight.current = onSend(reply);
  };
  const replies = role === 'driver' ? CHAT_COPY.quickRepliesDriver : CHAT_COPY.quickRepliesPassenger;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.bar}
      contentContainerStyle={styles.row}
      accessibilityLabel={CHAT_COPY.quickRepliesA11y}
      testID="chat-quick-replies"
    >
      {replies.map((reply, index) => (
        <Chip key={reply} label={reply} onPress={() => pick(reply)} testID={`chat-quick-reply-${index}`} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A horizontal ScrollView grows to fill a column unless told not to.
  bar: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: layout.gutter, paddingVertical: space[2], gap: space[2] },
});
