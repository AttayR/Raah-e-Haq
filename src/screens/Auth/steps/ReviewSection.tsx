import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Card, Icon } from '../../../components/ui';
import { REGISTRATION_FIELDS } from '../../../features/auth/copy/registrationFields';
import { componentTokens, radius, space } from '../../../theme';

const R = REGISTRATION_FIELDS.review;
const THUMB = componentTokens.uploadTile.thumb;

type SectionProps = React.PropsWithChildren<{
  title: string;
  /** Jumps to the page that edits this section; no button without it. */
  onEdit?: () => void;
  testID?: string;
}>;

/** A review group: title + ghost "Edit" in the header, then label/value rows (spec auth-registration). */
export function ReviewSection({ title, onEdit, testID, children }: SectionProps) {
  return (
    <Card variant="outlined" testID={testID}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {onEdit ? (
          <Button
            label={R.edit}
            variant="ghost"
            size="sm"
            onPress={onEdit}
            accessibilityLabel={R.editA11y(title)}
            testID={testID ? `${testID}-edit` : undefined}
          />
        ) : null}
      </View>
      <View style={styles.rows}>{children}</View>
    </Card>
  );
}

/** Label (`caption` muted) above the value (`body`); empty values read "Not provided". */
export function ReviewRow({ label, value, testID }: { label: string; value?: string | null; testID?: string }) {
  return (
    <View style={styles.row} testID={testID} accessible accessibilityLabel={`${label}, ${value || R.notProvided}`}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body" color={value ? 'textPrimary' : 'textMuted'}>
        {value || R.notProvided}
      </AppText>
    </View>
  );
}

/** 64×64 document thumbnails in a wrapping row; a missing photo shows a muted placeholder. */
export function ReviewThumbs({ items }: { items: ReadonlyArray<{ label: string; uri?: string | null }> }) {
  const { theme } = useAppTheme();
  return (
    <View style={styles.thumbs}>
      {items.map(({ label, uri }) => (
        <View key={label} style={styles.thumbItem} accessible accessibilityLabel={uri ? label : `${label}, ${R.noPhoto}`}>
          {uri ? (
            <Image source={{ uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.placeholder, { backgroundColor: theme.colors.surfaceAlt }]}>
              <Icon name="addPhoto" size={20} color="textMuted" />
            </View>
          )}
          <AppText variant="caption" color="textSecondary" align="center" numberOfLines={2}>
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: componentTokens.button.height.sm },
  title: { flex: 1 },
  rows: { gap: space[3], marginTop: space[3] },
  row: { gap: space[0] },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  thumbItem: { width: THUMB + space[4], alignItems: 'center', gap: space[1] },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
});
