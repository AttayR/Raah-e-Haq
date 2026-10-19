import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { AppText, IconButton, Screen } from '../../components/ui';
import { t } from '../../i18n';
import { layout, space } from '../../theme';
import { COLOR_PART_COUNT, ColorSection } from './sections/ColorSection';
import { FormatSection, HapticsSection } from './sections/FormatSection';
import { ICON_PART_COUNT, IconSection } from './sections/IconSection';
import { ButtonSection } from './sections/ButtonSection';
import { FieldSection } from './sections/FieldSection';
import { DoneBarSection } from './sections/DoneBarSection';
import { ProfileSection } from './sections/ProfileSection';
import { DialogSection, FeedbackSection, StatesSection } from './sections/FeedbackSections';
import { SheetSection } from './sections/SheetSection';
import {
  RideAddressSection,
  RideFareSection,
  RideMapSection,
  RidePersonSection,
  RidePinsSection,
  RideProgressSection,
  RideRatingSection,
  RideVehiclesSection,
} from './sections/RideSections';
import { DriverRidePreview, TripAssignedPreview } from './sections/RideScreenPreviews';
import { ActivityHistoryPreview, ActivityRowsPreview } from './sections/ActivityPreviews';
import { REGISTRATION_PREVIEWS } from './sections/RegistrationPreviews';
import { AUTH_STATE_PREVIEWS } from './sections/AuthStatePreviews';
import {
  ChatThreadPreview,
  InboxMessagesPreview,
  InboxMessagesStatePreview,
  InboxNotificationsPreview,
  InboxNotificationsStatePreview,
} from './sections/InboxPreviews';
import { VehicleMotionSection } from './sections/VehicleMotionSection';
import {
  LargeTitlePreview,
  PayCommissionPreview,
  SettlementsPreview,
  SignOutDialogPreview,
  TransactionPreview,
  WalletEmptyPreview,
  WalletErrorPreview,
  WalletLoadedPreview,
  WalletSkeletonPreview,
} from './sections/ScreenStatePreviews';
import { CardSection, HeaderSection, ListSection } from './sections/StructureSections';
import { BadgeSection, SelectionSection } from './sections/SelectionSection';
import { ComponentTokenSection, ElevationSection, RadiusSection, SpacingSection } from './sections/ScaleSections';
import { TYPE_PART_COUNT, TypeSection } from './sections/TypeSection';

/** Section keys, in display order. Numbered keys (`colors1`, `type2`, …) are parts sized for one SE screen. */
type Section = [string, () => React.ReactElement];

const parts = (prefix: string, count: number, render: (i: number) => React.ReactElement): Section[] =>
  Array.from({ length: count }, (_, i): Section => [`${prefix}${i + 1}`, () => render(i)]);

const SECTIONS: Section[] = [
  ...parts('colors', COLOR_PART_COUNT, i => <ColorSection part={i} />),
  ...parts('type', TYPE_PART_COUNT, i => <TypeSection part={i} />),
  ...parts('icons', ICON_PART_COUNT, i => <IconSection part={i} />),
  ['format', () => <FormatSection />],
  ['buttons1', () => <ButtonSection part={1} />],
  ['buttons2', () => <ButtonSection part={2} />],
  ['buttons3', () => <ButtonSection part={3} />],
  ['fields1', () => <FieldSection part={1} />],
  ['fields2', () => <FieldSection part={2} />],
  ['donebar', () => <DoneBarSection />],
  ['selection', () => <SelectionSection />],
  ['badges', () => <BadgeSection />],
  ['headers', () => <HeaderSection />],
  ['cards', () => <CardSection />],
  ['lists', () => <ListSection />],
  ['profile', () => <ProfileSection />],
  ['feedback', () => <FeedbackSection />],
  ['states', () => <StatesSection />],
  ['dialog', () => <DialogSection />],
  ['sheet', () => <SheetSection />],
  // UI-R5 ride components.
  ['ride-map', () => <RideMapSection />],
  ['ride-pins', () => <RidePinsSection />],
  // T-517 live vehicle markers.
  ['ride-live', () => <VehicleMotionSection />],
  ['ride-address', () => <RideAddressSection />],
  ['ride-vehicles', () => <RideVehiclesSection />],
  ['ride-fare', () => <RideFareSection />],
  ['ride-person', () => <RidePersonSection />],
  ['ride-progress', () => <RideProgressSection />],
  ['ride-rating', () => <RideRatingSection />],
  ['spacing', () => <SpacingSection />],
  ['radius', () => <RadiusSection />],
  ['elevation', () => <ElevationSection />],
  ['components1', () => <ComponentTokenSection groups={['button', 'iconButton']} />],
  ['components3', () => <ComponentTokenSection groups={['textField', 'otp', 'segmented', 'chip', 'badge', 'selectionControl']} />],
  ['components2', () => <ComponentTokenSection groups={['header', 'tabBar']} />],
  ['components4', () => <ComponentTokenSection groups={['listItem', 'sheet', 'dialog', 'toast', 'emptyState', 'skeleton', 'mapControls']} />],
  ['components5', () => <ComponentTokenSection groups={['ride']} />],
  ['haptics', () => <HapticsSection />],
];

/**
 * Full-screen screen-state previews (UI-R3 evidence): shown alone, without the gallery heading,
 * when `-RHKitGallerySection` names exactly one of them.
 */
const SCREEN_PREVIEWS: Section[] = [
  ['screen-trip-assigned', () => <TripAssignedPreview />],
  ['screen-driver-ride', () => <DriverRidePreview />],
  ['screen-wallet', () => <WalletLoadedPreview />],
  ['screen-wallet-skeleton', () => <WalletSkeletonPreview />],
  ['screen-wallet-error', () => <WalletErrorPreview />],
  ['screen-wallet-empty', () => <WalletEmptyPreview />],
  ['screen-history-loading', () => <ActivityHistoryPreview state="loading" />],
  ['screen-history-empty', () => <ActivityHistoryPreview state="empty" />],
  ['screen-history-error', () => <ActivityHistoryPreview state="error" />],
  ['screen-history-rows', () => <ActivityRowsPreview />],
  ['screen-settlements', () => <SettlementsPreview state="loaded" />],
  ['screen-settlements-skeleton', () => <SettlementsPreview state="skeleton" />],
  ['screen-settlements-empty', () => <SettlementsPreview state="empty" />],
  ['screen-settlements-error', () => <SettlementsPreview state="error" />],
  ['screen-pay', () => <PayCommissionPreview />],
  ['screen-transaction-skeleton', () => <TransactionPreview state="skeleton" />],
  ['screen-transaction-error', () => <TransactionPreview state="error" />],
  ['screen-signout', () => <SignOutDialogPreview />],
  ['screen-large', () => <LargeTitlePreview scrolled={false} />],
  ['screen-large-scrolled', () => <LargeTitlePreview scrolled />],
  ['screen-inbox-notifications', () => <InboxNotificationsPreview />],
  ['screen-inbox-notifications-loading', () => <InboxNotificationsStatePreview kind="loading" role="passenger" />],
  ['screen-inbox-notifications-empty', () => <InboxNotificationsStatePreview kind="empty" role="driver" />],
  ['screen-inbox-notifications-error', () => <InboxNotificationsStatePreview kind="error" role="passenger" />],
  ['screen-inbox-messages', () => <InboxMessagesPreview />],
  ['screen-inbox-messages-loading', () => <InboxMessagesStatePreview kind="loading" role="passenger" />],
  ['screen-inbox-messages-empty', () => <InboxMessagesStatePreview kind="empty" role="driver" />],
  ['screen-inbox-messages-error', () => <InboxMessagesStatePreview kind="error" role="passenger" />],
  ['screen-chat-thread', () => <ChatThreadPreview state="open" />],
  ['screen-chat-thread-closed', () => <ChatThreadPreview state="closed" />],
  ['screen-chat-thread-loading', () => <ChatThreadPreview state="loading" />],
  ...REGISTRATION_PREVIEWS,
  ...AUTH_STATE_PREVIEWS,
];

export const GALLERY_SECTION_KEYS = [...SECTIONS, ...SCREEN_PREVIEWS].map(([key]) => key);

type Props = {
  onClose: () => void;
  /** Comma-separated section keys to show alone (scripted screenshots); all when omitted. */
  only?: string;
};

/**
 * Debug-only kit gallery (UI-R1, DESIGN_SYSTEM v1.1): every colour token with its contrast
 * pair, every text style, the spacing/radius/elevation scales, v1.1 component tokens, every
 * icon, the formatters, the haptic patterns and the kit components. Opened from the React
 * Native dev menu ("Open UI kit gallery") through `DevKitGalleryHost`; never reachable in a
 * release build.
 */
export function KitGalleryScreen({ onClose, only }: Props) {
  const { theme } = useAppTheme();
  const wanted = only ? only.split(',').map(k => k.trim()) : null;
  const preview = wanted?.length === 1 ? SCREEN_PREVIEWS.find(([key]) => key === wanted[0]) : undefined;
  if (preview) {
    return <React.Fragment>{preview[1]()}</React.Fragment>;
  }
  const shown = wanted ? SECTIONS.filter(([key]) => wanted.includes(key)) : SECTIONS;
  return (
    <Screen scroll edges={['top', 'bottom']} contentStyle={styles.content} testID="kit-gallery">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="h1" accessibilityRole="header">
            {t('kitGallery.title')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('kitGallery.subtitle')}
          </AppText>
          <AppText variant="label" color="primaryText" testID="kit-gallery-mode">
            {t('kitGallery.modeLabel', { mode: theme.mode })}
          </AppText>
        </View>
        <IconButton
          icon="close"
          variant="tonal"
          onPress={onClose}
          accessibilityLabel={t('kitGallery.closeA11y')}
          testID="kit-gallery-close"
        />
      </View>
      {shown.map(([key, render]) => (
        <React.Fragment key={key}>{render()}</React.Fragment>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.gutter, paddingBottom: space[8] },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingTop: space[4] },
  headerText: { flex: 1, gap: space[1] },
});
