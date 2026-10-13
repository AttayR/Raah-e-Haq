import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { AppText, IconButton, Screen } from '../../../components/ui';
import { space } from '../../../theme';
import { DRIVER_DOCUMENTS_COPY } from '../copy';
import { useDriverDocuments } from '../hooks';
import { DriverDocumentsList } from '../components/DriverDocumentsList';
import { VehicleCard } from '../../driver-profile/components/VehicleCard';
import { useMyVehicles } from '../../driver-profile/hooks';

/**
 * Driver Settings → Vehicle & documents (T-203): the same list as the pending-driver screen.
 * Approved and in-review items are read-only; Upload / Re-upload appears only where the server
 * allows it (a rejected or missing item). T-514: the registered vehicle (make, model, plate and
 * its review status, GET /profile/documents) heads the list.
 */
export function DriverDocumentsScreen() {
  const navigation = useNavigation();
  const { documents, allRequiredApproved, loading, error, uploadingType, reload, upload } = useDriverDocuments();
  const vehicleType = useSelector((state: RootState) => state.apiAuth.user?.vehicle_type);
  const vehicles = useMyVehicles(useIsFocused());

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
      <VehicleCard vehicles={vehicles} vehicleType={vehicleType} testID="driver-documents-vehicle" />
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
