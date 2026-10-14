import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Avatar, IconButton } from '../../../components/ui';
import { space } from '../../../theme';
import { CHAT_COPY } from '../copy';

type Props = {
  name: string;
  subtitle: string;
  photoUrl: string | null;
  onBack: () => void;
  /** Shown only when the ride says `contact.can_call` (a masked call, BE-78). */
  onCall?: () => void;
};

/** The thread's header (T-510): back, the other party's photo and name, and Call. */
export const ChatThreadHeader: React.FC<Props> = ({ name, subtitle, photoUrl, onBack, onCall }) => {
  const { theme } = useAppTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      testID="chat-header"
    >
      <View style={I18nManager.isRTL ? styles.flip : null}>
        <IconButton icon="back" onPress={onBack} accessibilityLabel={CHAT_COPY.back} testID="chat-back" />
      </View>
      <Avatar name={name} uri={photoUrl} size={40} />
      <View style={styles.text}>
        <AppText variant="title" numberOfLines={1} accessibilityRole="header" testID="chat-header-name">
          {name}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
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
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, minWidth: 0 },
  flip: { transform: [{ scaleX: -1 }] },
});
