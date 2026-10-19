import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { haptics } from '../../../core/haptics';
import type { AutoAcceptSettings, AutoAcceptUpdate, StepperLimits } from '../../../features/driver-auto-accept/api';
import {
  canStep,
  clampToLimits,
  formatPickupKm,
  stepValue,
} from '../../../features/driver-auto-accept/format';
import type { AutoAcceptSaveResult } from '../../../features/driver-auto-accept/hooks';
import type { AutoAcceptLoad } from '../../../features/driver-auto-accept/slice';
import { vehicleLabel } from '../../../features/ride-history/copy';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import {
  AppText,
  Banner,
  BottomSheet,
  Button,
  Chip,
  ErrorState,
  IconButton,
  OfflineBanner,
  Skeleton,
  Switch,
  useIsOffline,
  vehicleIconName,
} from '../../ui';

/** §7.2: the "pick at least one" caption shows for 3 s. */
export const TIERS_HINT_MS = 3_000;
const SKELETON_SECTION_HEIGHT = 72;

type Props = {
  visible: boolean;
  settings: AutoAcceptSettings | null;
  loadStatus: AutoAcceptLoad;
  saving: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSave: (body: AutoAcceptUpdate) => Promise<AutoAcceptSaveResult>;
};

interface Draft {
  minFare: number;
  km: number;
  tiers: string[];
  womenOnly: boolean | null;
}

const draftOf = (settings: AutoAcceptSettings): Draft => ({
  minFare: clampToLimits(settings.minFare ?? settings.limits.minFare.min, settings.limits.minFare),
  km: clampToLimits(settings.maxPickupKm, settings.limits.maxPickupKm),
  tiers: settings.effectiveTiers.length > 0 ? [...settings.effectiveTiers] : [...settings.eligibleTiers],
  womenOnly: settings.womenPassengersOnly,
});

/** Laravel names array items `tiers.0`; they belong under the ride types. */
const fieldError = (errors: Record<string, string>, field: string): string | null =>
  errors[field] ?? Object.entries(errors).find(([key]) => key.startsWith(`${field}.`))?.[1] ?? null;

type StepperProps = {
  label: string;
  value: number;
  valueText: string;
  caption: string;
  limits: StepperLimits;
  downLabel: string;
  upLabel: string;
  error: string | null;
  disabled: boolean;
  onChange: (value: number) => void;
  testID: string;
};

/** − value + (same anatomy as the passenger OfferStepper), limits from the server. */
function LimitStepper({ label, value, valueText, caption, limits, downLabel, upLabel, error, disabled, onChange, testID }: StepperProps) {
  const press = (direction: 1 | -1) => {
    haptics.selection();
    onChange(stepValue(value, limits, direction));
  };
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="label" color="textSecondary">
        {label}
      </AppText>
      <View style={styles.stepperRow}>
        <IconButton
          icon="minus"
          variant="tonal"
          onPress={() => press(-1)}
          disabled={disabled || !canStep(value, limits, -1)}
          accessibilityLabel={downLabel}
          testID={`${testID}-down`}
        />
        <AppText
          variant="numericL"
          align="center"
          style={styles.flex}
          accessibilityLiveRegion="polite"
          testID={`${testID}-value`}
        >
          {valueText}
        </AppText>
        <IconButton
          icon="add"
          variant="tonal"
          onPress={() => press(1)}
          disabled={disabled || !canStep(value, limits, 1)}
          accessibilityLabel={upLabel}
          testID={`${testID}-up`}
        />
      </View>
      <AppText variant="caption" color={error ? 'danger' : 'textSecondary'} testID={`${testID}-caption`}>
        {error ?? caption}
      </AppText>
    </View>
  );
}

/**
 * Auto-accept settings (map-vehicles.md §7.2), a modal kit BottomSheet: minimum fare and max
 * pickup distance steppers inside the server's `limits`, ride-type chips from `eligible_tiers`,
 * "women passengers only" when the server sends it, the strike warning, then "Turn on" (off) or
 * "Save" + "Turn off" (on). The fare itself stays server-set. Loading: skeletons, footer
 * disabled. Offline: OfflineBanner, footer disabled. 422 errors show under their field.
 */
export function AutoAcceptSheet({ visible, settings, loadStatus, saving, onClose, onRetry, onSave }: Props) {
  const offline = useIsOffline();
  const [draft, setDraft] = useState<Draft | null>(settings ? draftOf(settings) : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tiersHint, setTiersHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A fresh draft each time the sheet opens (or once the settings arrive while it is open). Only
  // then: a later read (or the saved answer) must not reset the driver's edits, so the settings
  // are read through a ref.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const hasSettings = settings !== null;
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setTiersHint(false);
    setDraft(settingsRef.current ? draftOf(settingsRef.current) : null);
  }, [visible, hasSettings]);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const refused = settings !== null && !settings.available;
  const on = settings?.enabled === true;
  const footerDisabled = !draft || offline || saving;

  const toggleTier = (tier: string) => {
    if (!draft) return;
    const selected = draft.tiers.includes(tier);
    if (selected && draft.tiers.length === 1) {
      setTiersHint(true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setTiersHint(false), TIERS_HINT_MS);
      return;
    }
    setDraft({ ...draft, tiers: selected ? draft.tiers.filter((item) => item !== tier) : [...draft.tiers, tier] });
  };

  const submit = async (enabled: boolean) => {
    if (!draft || !settings || saving) return;
    const body: AutoAcceptUpdate = enabled
      ? {
          enabled: true,
          min_fare: draft.minFare,
          max_pickup_km: draft.km,
          tiers: draft.tiers,
          ...(draft.womenOnly !== null ? { women_passengers_only: draft.womenOnly } : {}),
        }
      : { enabled: false };
    setErrors({});
    const result = await onSave(body);
    if (result.ok) {
      onClose();
    } else {
      setErrors(result.fieldErrors);
    }
  };

  const kmStep = settings?.limits.maxPickupKm.step ?? 1;
  const offlineLabel = t('autoAccept.youAreOffline');

  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      accessibilityLabel={t('autoAccept.title')}
      testID="auto-accept-sheet"
      header={
        <View style={styles.header}>
          {offline ? <OfflineBanner /> : null}
          <AppText variant="h3" accessibilityRole="header">
            {t('autoAccept.title')}
          </AppText>
          <AppText variant="bodySmall" color="textSecondary">
            {t('autoAccept.intro')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          {on ? (
            <>
              <Button
                label={offline ? offlineLabel : t('autoAccept.save')}
                size="lg"
                onPress={() => submit(true)}
                loading={saving}
                disabled={footerDisabled || refused}
                testID="auto-accept-save"
              />
              <Button
                label={t('autoAccept.turnOff')}
                variant="ghost"
                onPress={() => submit(false)}
                disabled={footerDisabled}
                testID="auto-accept-turn-off"
              />
            </>
          ) : (
            <Button
              label={offline ? offlineLabel : t('autoAccept.turnOn')}
              size="lg"
              onPress={() => submit(true)}
              loading={saving}
              disabled={footerDisabled || refused}
              testID="auto-accept-turn-on"
            />
          )}
        </View>
      }
    >
      <View style={styles.body}>
        {!settings || !draft ? (
          loadStatus === 'failed' ? (
            <ErrorState
              title={t('autoAccept.loadFailed')}
              onRetry={onRetry}
              size="compact"
              testID="auto-accept-sheet-error"
            />
          ) : (
            <View style={styles.sections} testID="auto-accept-sheet-loading">
              <Skeleton shape="block" height={SKELETON_SECTION_HEIGHT} />
              <Skeleton shape="block" height={SKELETON_SECTION_HEIGHT} />
              <Skeleton shape="block" height={SKELETON_SECTION_HEIGHT} />
            </View>
          )
        ) : (
          <View style={styles.sections}>
            {refused && settings.unavailableMessage ? (
              <Banner tone="warning" text={settings.unavailableMessage} testID="auto-accept-sheet-refused" />
            ) : null}
            <LimitStepper
              label={t('autoAccept.minFareLabel')}
              value={draft.minFare}
              valueText={formatMoney(draft.minFare)}
              caption={t('autoAccept.minFareCaption', { fare: formatMoney(draft.minFare) })}
              limits={settings.limits.minFare}
              downLabel={t('autoAccept.minFareDown')}
              upLabel={t('autoAccept.minFareUp')}
              error={fieldError(errors, 'min_fare')}
              disabled={saving}
              onChange={(minFare) => setDraft({ ...draft, minFare })}
              testID="auto-accept-min-fare"
            />
            <LimitStepper
              label={t('autoAccept.pickupLabel')}
              value={draft.km}
              valueText={t('autoAccept.pickupValue', { km: formatPickupKm(draft.km, kmStep) })}
              caption={t('autoAccept.pickupCaption', { km: formatPickupKm(draft.km, kmStep) })}
              limits={settings.limits.maxPickupKm}
              downLabel={t('autoAccept.pickupDown')}
              upLabel={t('autoAccept.pickupUp')}
              error={fieldError(errors, 'max_pickup_km')}
              disabled={saving}
              onChange={(km) => setDraft({ ...draft, km })}
              testID="auto-accept-pickup"
            />
            {settings.eligibleTiers.length > 0 ? (
              <View style={styles.section} testID="auto-accept-tiers">
                <AppText variant="label" color="textSecondary">
                  {t('autoAccept.tiersLabel')}
                </AppText>
                {settings.eligibleTiers.length === 1 ? (
                  <AppText variant="body" testID="auto-accept-single-tier">
                    {vehicleLabel(settings.eligibleTiers[0]) ?? settings.eligibleTiers[0]}
                  </AppText>
                ) : (
                  <View style={styles.chips}>
                    {settings.eligibleTiers.map((tier) => (
                      <Chip
                        key={tier}
                        label={vehicleLabel(tier) ?? tier}
                        icon={vehicleIconName(tier)}
                        selected={draft.tiers.includes(tier)}
                        onPress={() => toggleTier(tier)}
                        disabled={saving}
                        testID={`auto-accept-tier-${tier}`}
                      />
                    ))}
                  </View>
                )}
                {tiersHint || fieldError(errors, 'tiers') ? (
                  <AppText variant="caption" color="danger" accessibilityLiveRegion="polite" testID="auto-accept-tiers-error">
                    {fieldError(errors, 'tiers') ?? t('autoAccept.tiersAtLeastOne')}
                  </AppText>
                ) : null}
              </View>
            ) : null}
            {draft.womenOnly !== null ? (
              <View style={styles.toggleRow} testID="auto-accept-women-only">
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{t('autoAccept.womenOnlyLabel')}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {t('autoAccept.womenOnlyCaption')}
                  </AppText>
                </View>
                <Switch
                  value={draft.womenOnly}
                  onValueChange={(womenOnly) => setDraft({ ...draft, womenOnly })}
                  disabled={saving}
                  accessibilityLabel={t('autoAccept.womenOnlyLabel')}
                  testID="auto-accept-women-only-switch"
                />
              </View>
            ) : null}
            <Banner tone="info" icon="info" text={t('autoAccept.strikeWarning')} testID="auto-accept-strike" />
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { gap: space[1], paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  body: { paddingHorizontal: layout.gutter, paddingBottom: space[2] },
  sections: { gap: space[6] },
  section: { gap: space[2] },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  footer: { gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
});

export default AutoAcceptSheet;
