import React from 'react';
import { ListItem } from '../../../components/ui';
import { t } from '../../../i18n';
import { toDriverWomenMode } from '../api';

/**
 * Driver Account (BE-87): the driver's own women-mode status, only when it applies to them:
 * verified for women-mode requests, or paused while the safety team reviews a report (never the
 * report itself). Every other driver sees nothing, so the row says nothing about anyone's gender.
 */
export function DriverWomenModeRow({ raw }: { raw: unknown }) {
  const mode = toDriverWomenMode(raw);
  if (!mode || (!mode.suspended && !mode.eligible)) return null;
  return (
    <ListItem
      icon="womenMode"
      title={t('womenMode.driverRowTitle')}
      subtitle={mode.suspended ? t('womenMode.driverSuspended') : t('womenMode.driverVerified')}
      testID="driver-settings-women-mode"
    />
  );
}
