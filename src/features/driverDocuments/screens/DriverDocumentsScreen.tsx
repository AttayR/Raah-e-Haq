import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppText, IconButton, Screen } from '../../../components/ui';
import { space } from '../../../theme';
import { DRIVER_DOCUMENTS_COPY } from '../copy';
import { useDriverDocuments } from '../hooks';
import { DriverDocumentsList } from '../components/DriverDocumentsList';

/**
 * Driver Settings → Vehicle & documents (T-203): the same list as the pending-driver screen.
 * Approved and in-review items are read-only; Upload / Re-upload appears only where the server
 * allows it (a rejected or missing item).
 */
export function DriverDocumentsScreen() {
  const navigation = useNavigation();
  const { documents, allRequiredApproved, loading, error, uploadingType, reload, upload } = useDriverDocuments();

  return (
    <Screen scroll contentStyle={styles.content} testID="driver-documents-screen">
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel={DRIVER_DOCUMENTS_COPY.back}
          onPress={() => navigation.goBack()}
          testID="driver-documents-back"
        />
        <AppText variant="h2" accessibilityRole="header" style={styles.title}>
          {DRIVER_DOCUMENTS_COPY.screenTitle}
        </AppText>
      </View>
      <DriverDocumentsList
        documents={documents}
        allRequiredApproved={allRequiredApproved}
        loading={loading}
        error={error}
        uploadingType={uploadingType}
        onRetry={reload}
        onUpload={(type) => {
          upload(type);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[4],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { flex: 1 },
});
