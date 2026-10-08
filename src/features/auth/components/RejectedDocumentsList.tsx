import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Typography } from '../../../theme/typography';
import type { AppTheme } from '../../../theme';
import { fillCopy, REJECTED_DOCUMENTS_COPY } from '../copy/accountStatus';
import type { RejectedItem, UploadFile, VehicleUploadField } from '../documentsApi';
import RejectedVehicleRow from './RejectedVehicleRow';
import { RADIUS, SPACING } from './accountStatusStyles';

/** Items shown before "Show N more", so many rejected items never make a very long page. */
export const COLLAPSED_ITEM_COUNT = 3;

interface Props {
  items: RejectedItem[];
  loading: boolean;
  error: string | null;
  uploadingKey: string | null;
  colors: AppTheme['colors'];
  onRetry: () => void;
  onReuploadDocument: (item: RejectedItem) => Promise<boolean>;
  onReuploadVehicle: (item: RejectedItem, files: Partial<Record<VehicleUploadField, UploadFile>>) => Promise<boolean>;
}

/**
 * A pending driver's rejected documents and vehicles, each with its reason and a re-upload.
 * Collapsed to COLLAPSED_ITEM_COUNT items; vehicles open their photo pickers on demand.
 */
export default function RejectedDocumentsList(props: Props) {
  const { items, loading, error, uploadingKey, colors, onRetry, onReuploadDocument, onReuploadVehicle } = props;
  const [showAll, setShowAll] = useState(false);
  const busy = uploadingKey !== null;
  const visible = showAll ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const hidden = items.length - visible.length;

  const renderDocumentAction = (item: RejectedItem) => {
    const uploading = uploadingKey === item.key;
    return (
      <TouchableOpacity
        testID={`reupload-${item.key}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: uploading }}
        disabled={busy}
        onPress={() => onReuploadDocument(item)}
        style={[styles.outline, { borderColor: busy ? colors.border : colors.accent }]}
      >
        {uploading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Icon name="file-upload" size={18} color={busy ? colors.mutedText : colors.accent} />
        )}
        <Text style={[styles.outlineText, { color: busy ? colors.mutedText : colors.accent }]}>
          {uploading ? REJECTED_DOCUMENTS_COPY.uploading : REJECTED_DOCUMENTS_COPY.reupload}
        </Text>
      </TouchableOpacity>
    );
  };

  let body: React.ReactNode;
  if (loading && items.length === 0) {
    body = (
      <View testID="rejected-documents-loading" style={styles.centerRow}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.muted, { color: colors.mutedText }]}>{REJECTED_DOCUMENTS_COPY.loading}</Text>
      </View>
    );
  } else if (error) {
    body = (
      <View testID="rejected-documents-error" style={styles.centerRow}>
        <Text style={[styles.muted, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onRetry}>
          <Text style={[styles.link, { color: colors.accent }]}>{REJECTED_DOCUMENTS_COPY.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (items.length === 0) {
    body = (
      <Text testID="rejected-documents-empty" style={[styles.muted, { color: colors.mutedText }]}>
        {REJECTED_DOCUMENTS_COPY.empty}
      </Text>
    );
  } else {
    body = (
      <>
        <Text style={[styles.muted, { color: colors.mutedText }]}>{REJECTED_DOCUMENTS_COPY.intro}</Text>
        {visible.map(item => (
          <View
            key={item.key}
            testID={`rejected-${item.key}`}
            style={[styles.item, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <View style={styles.itemHeader}>
              <Icon name={item.kind === 'vehicle' ? 'directions-car' : 'description'} size={20} color={colors.warning} />
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.label}</Text>
            </View>
            <Text style={[styles.itemReason, { color: colors.mutedText }]}>
              {item.reason ?? REJECTED_DOCUMENTS_COPY.noReason}
            </Text>
            {item.kind === 'document' ? (
              renderDocumentAction(item)
            ) : (
              <RejectedVehicleRow
                item={item}
                uploading={uploadingKey === item.key}
                disabled={busy && uploadingKey !== item.key}
                colors={colors}
                onSubmit={onReuploadVehicle}
              />
            )}
          </View>
        ))}
        {items.length > COLLAPSED_ITEM_COUNT ? (
          <TouchableOpacity
            testID="rejected-documents-toggle"
            accessibilityRole="button"
            onPress={() => setShowAll(prev => !prev)}
            style={styles.toggle}
          >
            <Text style={[styles.link, { color: colors.accent }]}>
              {hidden > 0 ? fillCopy(REJECTED_DOCUMENTS_COPY.showMore, { count: hidden }) : REJECTED_DOCUMENTS_COPY.showFewer}
            </Text>
          </TouchableOpacity>
        ) : null}
      </>
    );
  }

  const title = items.length > 0 ? `${REJECTED_DOCUMENTS_COPY.title} (${items.length})` : REJECTED_DOCUMENTS_COPY.title;
  return (
    <View testID="rejected-documents" style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: RADIUS.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  title: {
    ...Typography.subtitle,
    fontWeight: '700',
    fontSize: 16,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  muted: {
    ...Typography.subtitle,
  },
  link: {
    ...Typography.subtitle,
    fontWeight: '700',
  },
  item: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  itemTitle: {
    ...Typography.subtitle,
    fontWeight: '700',
    flex: 1,
  },
  itemReason: {
    ...Typography.subtitle,
  },
  outline: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  outlineText: {
    ...Typography.button,
  },
  toggle: {
    alignSelf: 'center',
    paddingVertical: SPACING.xs,
  },
});
