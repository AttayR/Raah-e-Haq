import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconProps } from './Icon';

/** Person glyph size for an avatar with no name (§4 icon sizes). */
const glyphSize = (size: AvatarSize): NonNullable<IconProps['size']> =>
  size >= 72 ? 48 : size >= 56 ? 32 : size >= 48 ? 28 : size >= 40 ? 24 : 20;

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
 * circle. Decorative: the name next to it is what screen readers read. T-594 (Android smoke
 * issue 8): the initials show until the photo has loaded (a slow or unreachable photo left a
 * blank circle on the first Home after sign-in), then the photo covers them.
 */
export function Avatar({ name, uri, size = 40, online = false, testID }: AvatarProps) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  // The URL whose photo has loaded: a new URL shows the initials until its own photo loads
  // (compared in render, so there is no frame with the old state).
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  // A new photo URL gets a fresh attempt; a URL that failed keeps the initials (UI-R2: no blobs).
  useEffect(() => setFailed(false), [uri]);
  const initials = initialsOf(name);
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const showPhoto = !!uri && uri.trim().length > 0 && !failed;
  const photoShown = showPhoto && loadedUri === uri;
  return (
    <View
      testID={testID}
      accessible={false}
      style={[
        styles.base,
        circle,
        { backgroundColor: photoShown ? theme.colors.surfaceAlt : theme.colors.primarySoft },
        online ? { borderWidth: theme.borderWidth.focus, borderColor: theme.colors.success } : null,
      ]}
    >
      {photoShown ? null : initials ? (
        <AppText variant={size >= 96 ? 'h2' : size >= 56 ? 'title' : 'label'} color="onPrimarySoft" testID={testID ? `${testID}-initials` : undefined}>
          {initials}
        </AppText>
      ) : (
        <Icon name="account" size={glyphSize(size)} color="onPrimarySoft" />
      )}
      {showPhoto ? (
        <Image
          source={{ uri: uri as string }}
          style={[styles.photo, circle]}
          onLoad={() => setLoadedUri(uri ?? null)}
          onError={() => setFailed(true)}
          testID={testID ? `${testID}-photo` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  photo: { position: 'absolute' },
});
