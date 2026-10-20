import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Badge, Button, Icon, ListGroup } from '../../../components/ui';
import { componentTokens, radius, space } from '../../../theme';
import { DRIVER_DOCUMENTS_COPY as COPY } from '../copy';
import { DOCUMENT_ICON, DOCUMENT_TONE, documentSubtitle } from '../screenModel';
import type { DriverDocument, DriverDocumentType } from '../types';

const k = componentTokens.listItem;

type RowProps = {
  doc: DriverDocument;
  uploadingType: DriverDocumentType | null;
  onUpload: (type: DriverDocumentType) => void;
};

/**
 * One document (driver-vehicle-documents.md §2.4): glyph tile, the type name, a status line
 * (date, "in review", the rejection reason or "Not uploaded yet"), a status Badge and, only when
 * the server's `can_upload` allows it, Upload / Re-upload under the text. No viewer: no URLs kept.
 */
function DocumentRowView({ doc, uploadingType, onUpload }: RowProps) {
  const { theme } = useAppTheme();
  const name = COPY.types[doc.type];
  const status = COPY.status[doc.status];
  const subtitle = documentSubtitle(doc);
  const uploading = uploadingType === doc.type;
  const action = doc.status === 'rejected' ? COPY.reupload : COPY.upload;
  return (
    <View style={styles.row} testID={`driver-document-${doc.type}`}>
      <View
        style={styles.main}
        accessible
        accessibilityLabel={[name, subtitle.text, status].join(', ')}
      >
        <View style={[styles.tile, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Icon name={DOCUMENT_ICON[doc.type]} color="textSecondary" />
        </View>
        <View style={styles.text}>
          <AppText variant="body" numberOfLines={2}>
            {name}
          </AppText>
          <AppText
            variant="bodySmall"
            color={subtitle.tone}
            numberOfLines={doc.status === 'rejected' ? 3 : 2}
            testID={doc.status === 'rejected' ? `driver-document-${doc.type}-reason` : `driver-document-${doc.type}-subtitle`}
          >
            {subtitle.text}
          </AppText>
        </View>
        <View style={styles.badge}>
          <Badge label={status} tone={DOCUMENT_TONE[doc.status]} testID={`driver-document-${doc.type}-status`} />
        </View>
      </View>
      {doc.canUpload ? (
        <View style={styles.action}>
          <Button
            label={action}
            accessibilityLabel={`${action} ${name}`}
            variant="outline"
            size="sm"
            leadingIcon="upload"
            fullWidth={false}
            loading={uploading}
            disabled={uploadingType !== null && !uploading}
            onPress={() => onUpload(doc.type)}
            testID={`driver-document-${doc.type}-upload`}
          />
        </View>
      ) : null}
    </View>
  );
}

export const DocumentRow = React.memo(DocumentRowView);

type GroupProps = {
  title: string;
  documents: ReadonlyArray<DriverDocument>;
  uploadingType: DriverDocumentType | null;
  onUpload: (type: DriverDocumentType) => void;
  testID: string;
};

/** Identity / Vehicle photos (§2.4): one grouped card of document rows, dividers inset 72. */
export function DocumentGroup({ title, documents, uploadingType, onUpload, testID }: GroupProps) {
  if (documents.length === 0) return null;
  return (
    <ListGroup title={title} inset="tile" testID={testID}>
      {documents.map((doc) => (
        <DocumentRow key={doc.type} doc={doc} uploadingType={uploadingType} onUpload={onUpload} />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: k.minHeight.two },
  main: { flexDirection: 'row', alignItems: 'flex-start' },
  tile: { width: k.tile, height: k.tile, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, marginStart: space[4] },
  badge: { marginStart: space[2], flexShrink: 0 },
  // Aligned with the text start (16 + 40 + 16 = 72 in the card).
  action: { marginTop: space[2], marginStart: k.tile + space[4], alignSelf: 'flex-start' },
});
