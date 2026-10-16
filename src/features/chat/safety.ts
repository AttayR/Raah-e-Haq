import { t } from '../../i18n';
import type { ChatMessage } from './types';

/** BE-89 `safety_warning.code` for a message that asks for money outside the app. */
export const CHAT_SAFETY_CODES = {
  moneyTransferRequest: 'money_transfer_request',
} as const;

export interface ChatSafetyNote {
  /** The viewer sent the flagged message (sender copy) or received it (recipient copy). */
  audience: 'sender' | 'recipient';
  text: string;
}

/**
 * The note to show under a message (BE-89), or null. Keyed on `code` and `sender_id`, never on
 * the server's `message`: REST words it for the caller but the `chat.message` socket event always
 * carries the recipient's wording, so both sides use the app copy. Without the viewer's id the
 * REST `is_mine` decides. An unknown code falls back to the server text, when there is one.
 */
export const chatSafetyNoteOf = (
  message: Pick<ChatMessage, 'safetyWarning' | 'senderId' | 'isMine'>,
  viewerId: number | null | undefined,
): ChatSafetyNote | null => {
  const warning = message.safetyWarning;
  if (!warning) return null;
  const mine = typeof viewerId === 'number' ? message.senderId === viewerId : message.isMine;
  const audience = mine ? 'sender' : 'recipient';
  if (warning.code === CHAT_SAFETY_CODES.moneyTransferRequest) {
    return { audience, text: t(mine ? 'chatSafety.moneySender' : 'chatSafety.moneyRecipient') };
  }
  const text = warning.message.trim();
  return text ? { audience, text } : null;
};
