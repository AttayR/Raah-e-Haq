import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText } from '../../../components/ui';
import { componentTokens, palette, space } from '../../../theme';
import { LOGIN_COPY } from '../copy/login';

const a = componentTokens.auth;

/** iPhone SE and other short screens: the compact badge and an `h2` title (spec auth-login). */
export const useCompactAuth = () => useWindowDimensions().height < a.compactWindowHeight;

interface Props {
  title: string;
  subtitle?: string;
  /** Logo badge above the title (Login). Off on the phone/code steps, which have a back header. */
  logo?: boolean;
  testID?: string;
}

/**
 * Top of every auth screen (UI-R6, specs auth-login / auth-phone-otp): an optional 72pt logo
 * badge (56 on small phones) on a white circle in both themes, then the `h1` title (`h2` on small
 * phones) and the subtitle, start-aligned at the gutter. Replaces the navy hero with decorative
 * circles and the illustrated wallpaper.
 */
export default function AuthIntro({ title, subtitle, logo = false, testID }: Props) {
  const { theme } = useAppTheme();
  const compact = useCompactAuth();
  const badge = compact ? a.logoBadgeCompact : a.logoBadge;
  const mark = compact ? a.logoCompact : a.logo;
  return (
    <View style={[styles.wrap, logo && { paddingTop: compact ? a.topSpaceCompact : a.topSpace }]} testID={testID}>
      {logo ? (
        <View
          style={[
            styles.badge,
            {
              width: badge,
              height: badge,
              borderRadius: badge / 2,
              backgroundColor: palette.extra.white,
              borderColor: theme.colors.border,
              borderWidth: theme.borderWidth.thin,
            },
            theme.mode === 'light' ? theme.elevation[1] : null,
          ]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={LOGIN_COPY.brandName}
          testID={testID ? `${testID}-logo` : undefined}
        >
          <Image
            source={require('../../../assets/images/logo.png')}
            style={{ width: mark, height: mark }}
            resizeMode="contain"
          />
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        <AppText variant={compact ? 'h2' : 'h1'} accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[6] },
  badge: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  titleBlock: { gap: space[2] },
});
