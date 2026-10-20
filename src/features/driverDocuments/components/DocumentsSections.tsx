import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  Card,
  ErrorState,
  Icon,
  ListGroup,
  ListItem,
  Skeleton,
  SkeletonGroup,
  type IconName,
  type TextColor,
} from '../../../components/ui';
import { componentTokens, radius, space, type SemanticColorName } from '../../../theme';
import { DRIVER_PROFILE_COPY as PROFILE_COPY } from '../../driver-profile/copy';
import { DRIVER_DOCUMENTS_COPY as COPY } from '../copy';
import { licenceExpiry, maskLicence, shortDate, type SummaryCase } from '../screenModel';
import type { DriverDocument, DriverDocumentType } from '../types';
import { DocumentRow } from './DocumentRows';

const d = componentTokens.documents;

const SUMMARY: Record<'action' | 'review' | 'approved', { fill: SemanticColorName; icon: IconName; tone: TextColor }> = {
  action: { fill: 'dangerSoft', icon: 'alertTriangle', tone: 'danger' },
  review: { fill: 'warningSoft', icon: 'pending', tone: 'warning' },
  approved: { fill: 'successSoft', icon: 'verified', tone: 'success' },
};

/** §2.1: one answer to "am I OK to drive?" before any reading: the coloured circle tells it. */
export function DocumentsSummaryCard({ summary }: { summary: SummaryCase }) {
  const { theme } = useAppTheme();
  if (!summary) return null;
  const look = SUMMARY[summary.kind];
  const title =
    summary.kind === 'action' ? COPY.summaryAction(summary.count) : summary.kind === 'review' ? COPY.summaryReview(summary.count) : COPY.summaryApproved;
  const body =
    summary.kind === 'action' ? COPY.summaryActionBody : summary.kind === 'review' ? COPY.summaryReviewBody : COPY.summaryApprovedBody;
  return (
    <View
      style={[styles.summary, { backgroundColor: theme.colors[look.fill] }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${body}`}
      testID="driver-documents-summary"
    >
      <View style={[styles.circle, { backgroundColor: theme.colors.surface }]}>
        <Icon name={look.icon} size={d.summaryGlyph} color={look.tone} />
      </View>
      <View style={styles.summaryText}>
        <AppText variant="title" testID="driver-documents-summary-title">
          {title}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary">
          {body}
        </AppText>
      </View>
    </View>
  );
}

type LicenceProps = {
  licenceNumber: string | null | undefined;
  licenceExpiryDate: string | null | undefined;
  /** The `license` document row (§2.3: everything about the licence in one place). */
  licenceDocument: DriverDocument | null;
  uploadingType: DriverDocumentType | null;
  onUpload: (type: DriverDocumentType) => void;
};

/** §2.3 Driving licence: masked number, expiry (with a warning banner near or past it) and the licence photo row. */
export function LicenceGroup({ licenceNumber, licenceExpiryDate, licenceDocument, uploadingType, onUpload }: LicenceProps) {
  const masked = maskLicence(licenceNumber);
  const expires = shortDate(licenceExpiryDate?.slice(0, 10) ?? null);
  const warning = licenceExpiry(licenceExpiryDate);
  const next = licenceDocument?.canUpload ? PROFILE_COPY.licenceUploadRenewed : PROFILE_COPY.licenceContactSupport;
  const value = (text: string | null, variant: 'numeric' | 'bodySmall', testID: string) => (
    <AppText variant={text ? variant : 'bodySmall'} color={text ? 'textSecondary' : 'textMuted'} numberOfLines={1} testID={testID}>
      {text ?? PROFILE_COPY.notAdded}
    </AppText>
  );
  return (
    <ListGroup title={PROFILE_COPY.licenceGroup} inset="tile" testID="driver-documents-licence">
      <ListItem
        icon="document"
        title={PROFILE_COPY.licenceNumber}
        trailing={value(masked, 'numeric', 'driver-documents-licence-number')}
        accessibilityLabel={`${PROFILE_COPY.licenceNumber}, ${masked ?? PROFILE_COPY.notAdded}`}
      />
      <View>
        <ListItem
          icon="calendar"
          title={PROFILE_COPY.licenceExpiry}
          trailing={value(expires, 'bodySmall', 'driver-documents-licence-expiry')}
          accessibilityLabel={`${PROFILE_COPY.licenceExpiry}, ${expires ?? PROFILE_COPY.notAdded}`}
        />
        {warning && expires ? (
          <Banner
            tone={warning === 'expired' ? 'danger' : 'warning'}
            text={`${warning === 'expired' ? PROFILE_COPY.licenceExpired : PROFILE_COPY.licenceExpiresOn(expires)} ${next}`}
            style={styles.expiryBanner}
            testID="driver-documents-licence-banner"
          />
        ) : null}
      </View>
      {licenceDocument ? <DocumentRow doc={licenceDocument} uploadingType={uploadingType} onUpload={onUpload} /> : null}
    </ListGroup>
  );
}

/** §3: the documents could not load (vehicle and licence still render from their own sources). */
export function DocumentsLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <Card>
      <ErrorState size="compact" title={COPY.loadFailed} retryLabel={COPY.retry} onRetry={onRetry} testID="driver-documents-error" />
    </Card>
  );
}

/** §3 first load: the layout's blocks at their resting heights (static with reduced motion). */
export function DocumentsSkeleton() {
  const heights = componentTokens.skeleton.heights;
  const row = componentTokens.listItem.minHeight.two;
  const group = (rows: number, height: number, key: string) => (
    <View key={key} style={styles.skeletonGroup}>
      <Skeleton width={componentTokens.skeleton.overline.width} height={componentTokens.skeleton.overline.height} style={styles.skeletonOverline} />
      <Skeleton shape="card" height={rows * height} />
    </View>
  );
  return (
    <SkeletonGroup testID="driver-documents-loading">
      <Skeleton shape="card" height={heights.documentsSummary} />
      {group(1, heights.documentsVehicleRow, 'vehicle')}
      {group(3, row, 'licence')}
      {group(3, row, 'identity')}
      {group(4, row, 'photos')}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: space[4], borderRadius: radius.lg },
  circle: {
    width: d.summaryCircle,
    height: d.summaryCircle,
    borderRadius: d.summaryCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: { flex: 1, minWidth: 0, gap: space[1] / 2 },
  expiryBanner: { marginHorizontal: space[4], marginBottom: space[3] },
  skeletonGroup: { marginTop: space[6] },
  skeletonOverline: { marginBottom: space[2], marginStart: space[4] },
});
