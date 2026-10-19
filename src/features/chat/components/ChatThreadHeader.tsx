import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, IconButton } from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';
import { CHAT_COPY } from '../copy';

type Props = {
  name: string;
  subtitle: string;
  photoUrl: string | null;
  onBack: () => void;
  /** Shown only when the ride says `contact.can_call` (a masked call, BE-78). */
  onCall?: () => void;
};

/**
 * The thread's header (T-510; UI-R14 shared-chat-thread §1): the kit `back` glyph (mirrors in
 * RTL), Avatar 32 + 8 + the other party's first name (`title`) over a `caption` line (vehicle
 * and plate for a passenger, "Your passenger" for a driver), and a tonal Call when the ride
 * allows a masked call. 56 high on `surface` with a bottom hairline; the `surface` fill runs up
 * under the status bar (the host Screen pads no top edge), so there is no two-tone band. Back
 * at x=4; the Call button's 40 visual ends 16 from the trailing edge (UI-R14 review ruling).
 */
export const ChatThreadHeader: React.FC<Props> = ({ name, subtitle, photoUrl, onBack, onCall }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingTop: insets.top },
      ]}
      testID="chat-header"
    >
      <View style={styles.inner}>
        <IconButton icon="back" onPress={onBack} accessibilityLabel={CHAT_COPY.back} testID="chat-back" />
        <View style={styles.person}>
          <Avatar name={name} uri={photoUrl} size={componentTokens.chat.headerAvatar} />
          <View style={styles.text}>
            <AppText variant="title" numberOfLines={1} accessibilityRole="header" testID="chat-header-name">
              {name}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" color="textMuted" numberOfLines={1} testID="chat-header-subtitle">
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </View>
        {onCall ? (
          <IconButton
            icon="phone"
            onPress={onCall}
            variant="tonal"
            iconColor="primaryText"
            accessibilityLabel={CHAT_COPY.callA11y(name)}
            testID="chat-call"
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: componentTokens.header.barHeight,
    paddingStart: componentTokens.header.backButtonStart,
    paddingEnd: layout.gutter,
  },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  text: { flex: 1, minWidth: 0 },
});
