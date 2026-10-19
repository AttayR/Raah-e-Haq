import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True while VoiceOver / TalkBack is on (null until the first answer). Timed UI that moves on
 * by itself (T-587 takeover) waits for the person instead. The listener is removed on unmount.
 */
export const useScreenReaderEnabled = (): boolean | null => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return enabled;
};
