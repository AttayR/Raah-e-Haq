import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useAppDispatch, type RootState } from '../../../store';
import { getUserProfile } from '../../../store/thunks/apiThunks';
import { AppText, Card, Header, Screen, useHeaderScroll } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { layout, space } from '../../../theme';
import { DRIVER_DOCUMENTS_COPY as COPY } from '../copy';
import { useDriverDocuments } from '../hooks';
import { documentsOf, IDENTITY_TYPES, summaryCase, VEHICLE_PHOTO_TYPES } from '../screenModel';
import { DocumentGroup } from '../components/DocumentRows';
import { DocumentsLoadFailed, DocumentsSkeleton, DocumentsSummaryCard, LicenceGroup } from '../components/DocumentsSections';
import { VehicleCard } from '../../driver-profile/components/VehicleCard';
import { useMyVehicles } from '../../driver-profile/hooks';
import type { DriverDocumentType } from '../types';

/**
 * Account → Vehicle & documents (T-203, T-514; UI-R17, docs/design/screens/driver-vehicle-
 * documents.md). Pinned standard Header; a summary card that answers "am I OK to drive?"; the
 * vehicle (GET /profile/documents), the driving licence (profile number masked, expiry, licence
 * photo), Identity and Vehicle photos (GET /driver/documents) with Upload / Re-upload only where
 * the server allows it. Skeleton on first load, pull to refresh, per-source error states.
 */
export function DriverDocumentsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const docs = useDriverDocuments();
  const { documents, allRequiredApproved, loading, error, uploadingType, reload, refresh, upload } = docs;
  const user = useSelector((state: RootState) => state.apiAuth.user);
  const vehicles = useMyVehicles(useIsFocused());
  const { scrollY, onScroll } = useHeaderScroll();

  // §3: one pull reads the documents, the vehicles and the profile again, in parallel, once each.
  const [pulling, setPulling] = useState(false);
  const inFlight = useRef(false);
  const { refresh: refreshVehicles } = vehicles;
  const onRefresh = useCallback(() => {
    if (inFlight.current || uploadingType !== null) return;
    inFlight.current = true;
    setPulling(true);
    Promise.all([refresh(), refreshVehicles(), dispatch(getUserProfile()).catch(() => undefined)])
      .then(([documentsOk]) => {
        if (!documentsOk) toast.warning(COPY.refreshFailed);
      })
      .finally(() => {
        inFlight.current = false;
        setPulling(false);
      });
  }, [dispatch, refresh, refreshVehicles, uploadingType]);

  const onUpload = useCallback((type: DriverDocumentType) => {
    upload(type);
  }, [upload]);

  const summary = useMemo(
    () => summaryCase(documents, vehicles.data, allRequiredApproved),
    [documents, vehicles.data, allRequiredApproved],
  );
  const licenceDocument = documents.find((doc) => doc.type === 'license') ?? null;
  const firstLoad = loading && documents.length === 0 && !error;
  const tint = theme.mode === 'dark' ? theme.colors.primaryText : theme.colors.primary;

  return (
    <Screen testID="driver-documents-screen">
      <Header
        title={COPY.screenTitle}
        backLabel={COPY.back}
        onBack={() => navigation.goBack()}
        tone="background"
        scrollY={scrollY}
        testID="driver-documents"
      />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID="driver-documents-scroll"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            enabled={uploadingType === null}
            tintColor={tint}
            colors={[tint]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        {firstLoad ? (
          <DocumentsSkeleton />
        ) : (
          <>
            {error ? null : <DocumentsSummaryCard summary={summary} />}
            <View style={styles.group}>
              <VehicleCard vehicles={vehicles} vehicleType={user?.vehicle_type} testID="driver-documents-vehicle" />
            </View>
            <View style={styles.group}>
              <LicenceGroup
                licenceNumber={user?.license_number}
                licenceExpiryDate={user?.license_expiry_date}
                licenceDocument={error ? null : licenceDocument}
                uploadingType={uploadingType}
                onUpload={onUpload}
              />
            </View>
            {error ? (
              <View style={styles.group}>
                <DocumentsLoadFailed onRetry={reload} />
              </View>
            ) : documents.length === 0 ? (
              <Card style={styles.group}>
                <AppText variant="bodySmall" color="textSecondary" testID="driver-documents-empty">
                  {COPY.empty}
                </AppText>
              </Card>
            ) : (
              <>
                <View style={styles.group}>
                  <DocumentGroup
                    title={COPY.groupIdentity}
                    documents={documentsOf(documents, IDENTITY_TYPES)}
                    uploadingType={uploadingType}
                    onUpload={onUpload}
                    testID="driver-documents-identity"
                  />
                </View>
                <View style={styles.group}>
                  <DocumentGroup
                    title={COPY.groupVehiclePhotos}
                    documents={documentsOf(documents, VEHICLE_PHOTO_TYPES)}
                    uploadingType={uploadingType}
                    onUpload={onUpload}
                    testID="driver-documents-photos"
                  />
                </View>
              </>
            )}
            <AppText variant="caption" color="textSecondary" style={styles.footer} testID="driver-documents-footer">
              {COPY.footer}
            </AppText>
          </>
        )}
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[8],
  },
  group: { marginTop: space[6] },
  footer: { marginTop: space[6], marginHorizontal: space[4] },
});
