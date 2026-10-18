import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useNow } from '../../fare/hooks';
import { toWomenModeSummary } from '../api';
import { useWomenModeChoice } from '../hooks';
import {
  DISMISS_SNOOZE_MS,
  shouldAskFallback,
  snoozeAfterKeepWaiting,
} from '../rules';
import type { WomenModeAction, WomenModeSummary } from '../types';

type Props = {
  rideId: number;
  /** Ride `women_mode` as the server sent it (raw); nothing renders without it. */
  raw: unknown;
  /**
   * [T-565] The ride is still searching. The panel keeps this mounted for the whole ride, so an
   * open choice sheet closes through `visible` (slides out) when a driver takes the ride instead
   * of being unmounted while it is up.
   */
  searching?: boolean;
};

/** The choice sheet: "Keep waiting" or "Allow any driver". Nothing changes without an answer. */
function FallbackSheet({
  visible,
  noneNearby,
  pending,
  error,
  onChoose,
  onClose,
}: {
  visible: boolean;
  noneNearby: boolean;
  pending: WomenModeAction | null;
  error: string | null;
  onChoose: (action: WomenModeAction) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      mode="modal"
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('womenMode.askTitle')}
      testID="women-mode-sheet"
      header={
        <View style={styles.header}>
          <AppText variant="h3" accessibilityRole="header">
            {t('womenMode.askTitle')}
          </AppText>
          <AppText
            variant="bodySmall"
            color="textSecondary"
            testID="women-mode-ask-text"
          >
            {noneNearby
              ? t('womenMode.askNoneNearby')
              : t('womenMode.askFallback')}
          </AppText>
        </View>
      }
      footer={
        <View style={styles.footer}>
          <Button
            label={t('womenMode.keepWaiting')}
            onPress={() => onChoose('keep_waiting')}
            loading={pending === 'keep_waiting'}
            disabled={pending !== null}
            testID="women-mode-keep-waiting"
          />
          <Button
            label={t('womenMode.allowAny')}
            variant="outline"
            onPress={() => onChoose('allow_any_driver')}
            loading={pending === 'allow_any_driver'}
            disabled={pending !== null}
            testID="women-mode-allow-any"
          />
        </View>
      }
    >
      {error ? (
        <View style={styles.body}>
          <AppText
            variant="bodySmall"
            color="danger"
            accessibilityLiveRegion="polite"
            testID="women-mode-error"
          >
            {error}
          </AppText>
        </View>
      ) : null}
    </BottomSheet>
  );
}

/**
 * Women mode while the ride searches (BE-87, passenger only): "Looking for a female driver"
 * with "Allow any driver", and the "Keep waiting / Allow any driver" sheet when the server says
 * no female driver is near (`no_female_drivers_nearby`) or none took it in time (`ask_fallback`).
 * "Keep waiting" holds the sheet back until the server's next ask; closing it without an answer
 * holds it back for a minute. "Allow any driver" stands until the server's block shows the ride
 * released (a poll that left before the answer cannot bring the sheet back). An inline answer
 * that fails says why under the status line.
 */
export function WomenModeSearching({ rideId, raw, searching = true }: Props) {
  const [answered, setAnswered] = useState<{
    rideId: number;
    raw: unknown;
    action: WomenModeAction;
    summary: WomenModeSummary;
  } | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const choice = useWomenModeChoice(rideId);

  // A new ride starts clean.
  useEffect(() => {
    setAnswered(null);
    setSnoozedUntil(null);
  }, [rideId]);

  const server = toWomenModeSummary(raw);
  const mine = answered && answered.rideId === rideId ? answered : null;
  // "Keep waiting": its block until the next poll (the snooze holds the sheet back after that).
  // "Allow any driver": its block until the server's shows the release, so a stale poll (sent
  // before the answer) can never re-open the sheet.
  const fresh =
    mine &&
    (mine.action === 'allow_any_driver'
      ? !releasedOnServer(server)
      : mine.raw === raw)
      ? mine.summary
      : null;
  const summary = fresh ?? server;
  const asking =
    searching &&
    !!summary &&
    summary.canAllowAnyDriver &&
    (summary.state === 'no_female_drivers_nearby' ||
      summary.state === 'ask_fallback');
  // Re-check the snooze while one is set (a small ticking leaf; nothing else re-renders).
  const now = useNow(asking && snoozedUntil !== null, 5000);
  const showSheet = searching && shouldAskFallback(summary, now, snoozedUntil);

  const choose = async (action: WomenModeAction) => {
    const next = await choice.choose(action);
    // Refused (the hook shows why) or skipped (one answer at a time): the sheet stays.
    if (!next) return;
    setAnswered({ rideId, raw, action, summary: next });
    if (action === 'keep_waiting')
      setSnoozedUntil(snoozeAfterKeepWaiting(next, Date.now()));
  };

  const released = summary?.state === 'released';
  // [T-565] The sheet sits outside the status block and is always rendered, so it closes through
  // `visible` when the ride is matched, released or no longer searching.
  return (
    <>
      {searching && summary && summary.state !== 'matched' ? (
        <View style={styles.wrap}>
          <View style={styles.row} testID="women-mode-status">
            <Icon
              name="womenMode"
              size={20}
              color={released ? 'textSecondary' : 'primaryText'}
            />
            <AppText
              variant="bodySmall"
              color="textSecondary"
              style={styles.flex}
              testID="women-mode-status-text"
            >
              {released ? t('womenMode.released') : t('womenMode.searching')}
            </AppText>
            {summary.canAllowAnyDriver && !showSheet ? (
              <Button
                label={t('womenMode.allowAny')}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => {
                  choose('allow_any_driver');
                }}
                disabled={choice.pending !== null}
                testID="women-mode-allow-any-inline"
              />
            ) : null}
          </View>
          {choice.error && !showSheet ? (
            <AppText
              variant="bodySmall"
              color="danger"
              accessibilityLiveRegion="polite"
              testID="women-mode-inline-error"
            >
              {choice.error}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <FallbackSheet
        visible={showSheet}
        noneNearby={summary?.state === 'no_female_drivers_nearby'}
        pending={choice.pending}
        error={choice.error}
        onChoose={action => {
          choose(action);
        }}
        onClose={() => setSnoozedUntil(Date.now() + DISMISS_SNOOZE_MS)}
      />
    </>
  );
}

/** The server's block shows the ride released (or no longer waiting for a female driver). */
const releasedOnServer = (server: WomenModeSummary | null): boolean =>
  !server ||
  !server.femaleDriverOnly ||
  server.state === 'released' ||
  server.state === 'matched';

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1, minWidth: 0 },
  header: {
    gap: space[1],
    paddingHorizontal: layout.gutter,
    paddingBottom: space[3],
  },
  body: { paddingHorizontal: layout.gutter },
  footer: { gap: space[2] },
});
