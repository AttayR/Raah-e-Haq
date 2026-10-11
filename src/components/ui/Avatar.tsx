import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from './AppText';

export type AvatarSize = 32 | 40 | 48 | 56 | 72 | 96;

export type AvatarProps = {
  name?: string | null;
  uri?: string | null;
  size?: AvatarSize;
  /** 2pt `success` ring (driver online, §5.13). */
  online?: boolean;
  testID?: string;
};

/** First letter of the first and last word of the name (§4). */
export const initialsOf = (name?: string | null): string => {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
};

/**
 * Avatar (DESIGN_SYSTEM §5.13): the photo, or initials on `primarySoft`; never an empty grey
 * circle. Decorative: the name next to it is what screen readers read.
 */
export function Avatar({ name, uri, size = 40, online = false, testID }: AvatarProps) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const showPhoto = !!uri && !failed;
  return (
    <View
      testID={testID}
      accessible={false}
      style={[
        styles.base,
        circle,
        { backgroundColor: showPhoto ? theme.colors.surfaceAlt : theme.colors.primarySoft },
        online ? { borderWidth: theme.borderWidth.focus, borderColor: theme.colors.success } : null,
      ]}
    >
      {showPhoto ? (
        <Image source={{ uri: uri as string }} style={[styles.photo, circle]} onError={() => setFailed(true)} />
      ) : (
        <AppText variant={size >= 56 ? 'title' : 'label'} color="onPrimarySoft">
          {initialsOf(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  photo: { position: 'absolute' },
});
