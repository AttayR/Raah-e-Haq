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
  /**
   * `compact` (UI-R10, a section inside a map sheet; the twin of the compact ErrorState): 48
   * `primarySoft` circle with a 24 `primaryText` glyph → 12 → title `title` → 4 → body `bodySmall`
   * `textSecondary` → 12 → optional `sm` secondary action, centred, no top offset.
   */
  size?: 'regular' | 'compact';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function CompactEmptyState({ icon, title, body, action, style, testID }: Omit<EmptyStateProps, 'size' | 'illustration' | 'placement'> & { icon: IconName }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.compact, style]} testID={testID} accessibilityLiveRegion="polite">
      <View
        style={[styles.compactCircle, { backgroundColor: theme.colors.primarySoft }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Icon name={icon} size={k.compactGlyph} color="primaryText" />
      </View>
      <View style={styles.compactText}>
        <AppText variant="title" align="center" accessibilityRole="header" style={styles.compactTitle}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {body}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <View style={styles.compactAction}>
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={action.loading}
            accessibilityHint={action.accessibilityHint}
            testID={action.testID ?? (testID ? `${testID}-action` : undefined)}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * EmptyState (DESIGN_SYSTEM §5.19, §12.6): centred column, max width 280: icon circle (96,
 * `primarySoft`, glyph 48 `primaryText`) or a duotone illustration → 16 → `h3` title → 8 → body
 * `bodySmall` `textSecondary` → 24 → optional `md` secondary button. Placed 64 from the top of the
 * content area, not vertically centred in long screens.
 */
export function EmptyState({ icon = 'info', size = 'regular', ...rest }: EmptyStateProps) {
  if (size === 'compact') {
    return <CompactEmptyState icon={icon} title={rest.title} body={rest.body} action={rest.action} style={rest.style} testID={rest.testID} />;
  }
  return <StateLayout icon={icon} circle="primarySoft" glyph="primaryText" actionVariant="secondary" {...rest} />;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space[4] },
  top: { paddingTop: k.topOffset, paddingBottom: space[8] },
  center: { flexGrow: 1, justifyContent: 'center', paddingVertical: space[8] },
  column: { width: '100%', maxWidth: k.maxWidth, alignItems: 'center' },
  circle: { width: k.circle, height: k.circle, borderRadius: k.circle / 2, alignItems: 'center', justifyContent: 'center' },
  illustration: { width: k.illustration, height: k.illustration },
  // T-594 (Android smoke issue 4): on Android/Fabric a centred heading that hugs its width in a
  // centred column (semibold, negative letter spacing) is measured too narrow and its last word
  // wraps out of sight ("No messages" read "No"). The title takes the column's width instead.
  title: { marginTop: space[4], alignSelf: 'stretch' },
  body: { marginTop: space[2] },
  action: { marginTop: space[6] },
  compact: { alignItems: 'center', gap: space[3], paddingVertical: space[2] },
  compactCircle: {
    width: k.compactCircle,
    height: k.compactCircle,
    borderRadius: k.compactCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactText: { alignItems: 'center', gap: space[1], width: '100%', maxWidth: k.maxWidth },
  compactTitle: { alignSelf: 'stretch' },
  // §5.4 ruling (UI-R8): a hugging button in a centred column centres itself.
  compactAction: { alignSelf: 'center' },
});
