import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, space, type SemanticColorName } from '../../theme';
import { AppText, type TextColor } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

const k = componentTokens.emptyState;

export type StateAction = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

type StateLayoutProps = {
  icon: IconName;
  circle: SemanticColorName;
  glyph: TextColor;
  /** Duotone illustration (≤120×120, navy-800 + saffron-500, src/assets/illustrations/) instead of the icon circle. */
  illustration?: ImageSourcePropType | React.ReactElement;
  title: string;
  body?: string;
  action?: StateAction;
  actionVariant: 'primary' | 'secondary';
  /** `top` (default): 64 from the top of the content area. `center`: centred in the space given. */
  placement?: 'top' | 'center';
  role?: 'alert';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Shared column of EmptyState and ErrorState (§5.19, §5.20). */
export function StateLayout({
  icon,
  circle,
  glyph,
  illustration,
  title,
  body,
  action,
  actionVariant,
  placement = 'top',
  role,
  style,
  testID,
}: StateLayoutProps) {
  const { theme } = useAppTheme();
  const art = illustration ? (
    React.isValidElement(illustration) ? (
      illustration
    ) : (
      <Image
        source={illustration as ImageSourcePropType}
        style={styles.illustration}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    )
  ) : (
    <View style={[styles.circle, { backgroundColor: theme.colors[circle] }]}>
      <Icon name={icon} size={k.glyph} color={glyph} />
    </View>
  );
  return (
    <View
      style={[styles.wrap, placement === 'center' ? styles.center : styles.top, style]}
      testID={testID}
      accessibilityRole={role}
      accessibilityLiveRegion={role ? 'polite' : undefined}
    >
      <View style={styles.column}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {art}
        </View>
        <AppText variant="h3" align="center" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="bodySmall" color="textSecondary" align="center" style={styles.body}>
            {body}
          </AppText>
        ) : null}
        {action ? (
          <View style={styles.action}>
            <Button
              label={action.label}
              onPress={action.onPress}
              variant={actionVariant}
              size="md"
              fullWidth={false}
              loading={action.loading}
              accessibilityHint={action.accessibilityHint}
              testID={action.testID ?? (testID ? `${testID}-action` : undefined)}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export type EmptyStateProps = {
  /** Glyph inside the 96 `primarySoft` circle (48, `primaryText`). */
  icon?: IconName;
  illustration?: ImageSourcePropType | React.ReactElement;
  /** One line: "No rides yet". */
  title: string;
  body?: string;
  /** The next step ("Book a ride"): an `md` secondary button. */
  action?: StateAction;
  placement?: 'top' | 'center';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * EmptyState (DESIGN_SYSTEM §5.19, §12.6): centred column, max width 280: icon circle (96,
 * `primarySoft`, glyph 48 `primaryText`) or a duotone illustration → 16 → `h3` title → 8 → body
 * `bodySmall` `textSecondary` → 24 → optional `md` secondary button. Placed 64 from the top of the
 * content area, not vertically centred in long screens.
 */
export function EmptyState({ icon = 'info', ...rest }: EmptyStateProps) {
  return <StateLayout icon={icon} circle="primarySoft" glyph="primaryText" actionVariant="secondary" {...rest} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space[4] },
  top: { paddingTop: k.topOffset, paddingBottom: space[8] },
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: space[8] },
  column: { width: '100%', maxWidth: k.maxWidth, alignItems: 'center' },
  circle: { width: k.circle, height: k.circle, borderRadius: k.circle / 2, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: k.illustration, height: k.illustration },
  title: { marginTop: space[4] },
  body: { marginTop: space[2] },
  action: { marginTop: space[6] },
});
