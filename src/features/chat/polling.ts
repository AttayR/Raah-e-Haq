/**
 * Polling for the chat thread (T-510). The open thread asks for `after_id` every 5 s while it is
 * focused and the app is in the foreground, on the app's shared poll engine (T-536:
 * `src/core/polling`, one request at a time, back-off, Retry-After).
 */
export {
  POLL_DEFAULT_INTERVAL_MS as CHAT_POLL_INTERVAL_MS,
  POLL_MAX_DELAY_MS as CHAT_POLL_MAX_DELAY_MS,
  POLL_MAX_BURST as CHAT_POLL_MAX_BURST,
  backoffDelay,
  usePolling,
  type PollOutcome,
  type PollingOptions,
} from '../../core/polling';
