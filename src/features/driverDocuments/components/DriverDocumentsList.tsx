import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Button, Card, type BadgeTone } from '../../../components/ui';
import { space } from '../../../theme';
import { DRIVER_DOCUMENTS_COPY } from '../copy';
import type { DriverDocument, DriverDocumentStatus, DriverDocumentType } from '../types';

const STATUS_TONE: Record<DriverDocumentStatus, BadgeTone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  missing: 'neutral',
};

export interface DriverDocumentsListProps {
  documents: DriverDocument[];
  allRequiredApproved: boolean;
  loading: boolean;
  error: string | null;
  uploadingType: DriverDocumentType | null;
  onRetry: () => void;
  onUpload: (type: DriverDocumentType) => void;
  testID?: string;
}

function DocumentRow({
  doc,
  uploadingType,
  onUpload,
}: {
  doc: DriverDocument;
  uploadingType: DriverDocumentType | null;
  onUpload: (type: DriverDocumentType) => void;
}) {
  const label = DRIVER_DOCUMENTS_COPY.types[doc.type];
  const status = DRIVER_DOCUMENTS_COPY.status[doc.status];
  const uploading = uploadingType === doc.type;
  return (
    <View style={styles.row} testID={`driver-document-${doc.type}`}>
      <View style={styles.rowHeader}>
        <View style={styles.rowText}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {label}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {doc.required ? DRIVER_DOCUMENTS_COPY.required : DRIVER_DOCUMENTS_COPY.optional}
          </AppText>
        </View>
        <Badge label={status} tone={STATUS_TONE[doc.status]} testID={`driver-document-${doc.type}-status`} />
      </View>
      {doc.status === 'rejected' ? (
        <AppText variant="bodySmall" color="danger" testID={`driver-document-${doc.type}-reason`}>
          {`${DRIVER_DOCUMENTS_COPY.reasonLabel} ${doc.rejectionReason ?? DRIVER_DOCUMENTS_COPY.noReason}`}
        </AppText>
      ) : null}
      {doc.canUpload ? (
        <Button
          label={doc.status === 'rejected' ? DRIVER_DOCUMENTS_COPY.reupload : DRIVER_DOCUMENTS_COPY.upload}
          accessibilityLabel={`${doc.status === 'rejected' ? DRIVER_DOCUMENTS_COPY.reupload : DRIVER_DOCUMENTS_COPY.upload} ${label}`}
          variant="outline"
          size="sm"
          leadingIcon="upload"
          fullWidth={false}
          loading={uploading}
          disabled={uploadingType !== null && !uploading}
          onPress={() => onUpload(doc.type)}
          testID={`driver-document-${doc.type}-upload`}
        />
      ) : null}
    </View>
  );
}

/**
 * The driver's documents with their review state (T-203, BE-66): label, status badge, the
 * rejection reason, and Upload / Re-upload when the server allows it (`can_upload`).
 * Loading, error (with retry) and empty states; one upload at a time.
 */
export function DriverDocumentsList({
  documents,
  allRequiredApproved,
  loading,
  error,
  uploadingType,
  onRetry,
  onUpload,
  testID = 'driver-documents',
}: DriverDocumentsListProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;

  let body: React.ReactNode;
  if (loading && documents.length === 0) {
    body = (
      <View style={styles.state} testID={`${testID}-loading`}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="bodySmall" color="textSecondary">
          {DRIVER_DOCUMENTS_COPY.loading}
        </AppText>
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.state} testID={`${testID}-error`}>
        <AppText variant="body" align="center">
          {error}
        </AppText>
        <Button
          label={DRIVER_DOCUMENTS_COPY.retry}
          variant="outline"
          size="sm"
          leadingIcon="retry"
          fullWidth={false}
          onPress={onRetry}
          testID={`${testID}-retry`}
        />
      </View>
    );
  } else if (documents.length === 0) {
    body = (
      <AppText variant="bodySmall" color="textSecondary" testID={`${testID}-empty`}>
        {DRIVER_DOCUMENTS_COPY.empty}
      </AppText>
    );
  } else {
    body = documents.map((doc, index) => (
      <React.Fragment key={doc.type}>
        {index > 0 ? (
          <View style={[styles.divider, { backgroundColor: colors.border, height: theme.borderWidth.hairline }]} />
        ) : null}
        <DocumentRow doc={doc} uploadingType={uploadingType} onUpload={onUpload} />
      </React.Fragment>
    ));
  }

  const showSummary = !error && documents.length > 0;

  return (
    <Card testID={testID}>
      <AppText variant="h3" accessibilityRole="header">
        {DRIVER_DOCUMENTS_COPY.title}
      </AppText>
      {showSummary ? (
        <AppText
          variant="bodySmall"
          color={allRequiredApproved ? 'success' : 'textSecondary'}
          style={styles.summary}
          testID={`${testID}-summary`}
        >
          {allRequiredApproved ? DRIVER_DOCUMENTS_COPY.allApproved : DRIVER_DOCUMENTS_COPY.intro}
        </AppText>
      ) : null}
      <View style={styles.body}>{body}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: space[1] },
  body: { marginTop: space[3] },
  state: { alignItems: 'center', gap: space[3], paddingVertical: space[4] },
  row: { gap: space[2], paddingVertical: space[3] },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, minWidth: 0 },
  divider: { alignSelf: 'stretch' },
});
