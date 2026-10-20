import React, { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Button, TextField } from '../../../components/ui';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { t } from '../../../i18n';
import { motion } from '../../../theme';
import { Anchored } from './stepParts';

/** The server's cap on `referral_code`. */
export const INVITE_CODE_MAX = 20;

const reveal = FadeIn.duration(motion.base.duration);

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** A 422 on `referral_code`: shown in our words, not the server's. */
  error?: string | null;
};

/**
 * "Have an invite code?" at the end of registration Step 1, both roles (shared-support-invite
 * §I4): a ghost button that reveals an optional field (250 ms fade, instant with Reduce Motion),
 * sent as `referral_code`. Empty never blocks Continue. Already open when a code was typed or the
 * server refused one.
 */
export default function InviteCodeField({ value, onChange, error }: Props) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(value.length > 0 || !!error);
  const shown = open || !!error;
  const inputRef = useRef<TextInput>(null);
  // Set by the tap: focus once the revealed field is laid out, so the keyboard reveal scrolls it
  // above the sticky footer (UI-R18 review). A field opened by a server error is not focused.
  const focusOnLayout = useRef(false);
  return (
    <Anchored field="inviteCode">
      {shown ? (
        <Animated.View
          entering={reduced ? undefined : reveal}
          onLayout={() => {
            if (!focusOnLayout.current) return;
            focusOnLayout.current = false;
            inputRef.current?.focus();
          }}
          testID="registration-invite"
        >
          <TextField
            ref={inputRef}
            label={t('invite.signupLabel')}
            value={value}
            onChangeText={(text) => onChange(text.replace(/\s+/g, ''))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={INVITE_CODE_MAX}
            error={error ? t('invite.signupInvalid') : null}
            testID="registration-invite-code"
          />
        </Animated.View>
      ) : (
        <View style={styles.toggle}>
          <Button
            label={t('invite.signupToggle')}
            variant="ghost"
            size="sm"
            fullWidth={false}
            flushStart
            leadingIcon="gift"
            onPress={() => {
              focusOnLayout.current = true;
              setOpen(true);
            }}
            testID="registration-invite-toggle"
          />
        </View>
      )}
    </Anchored>
  );
}

const styles = StyleSheet.create({
  toggle: { alignItems: 'flex-start' },
});
