import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '../ui/Chip';
import { space } from '../../theme';
import { BOOKING_COPY } from '../../features/ride-booking/copy';

type Props = {
  stage: 'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting';
};

type Stage = Exclude<Props['stage'], 'home'>;

const STAGES: readonly Stage[] = ['pickup', 'destination', 'vehicle', 'fare', 'requesting'];

/** Booking step indicator: one line that scrolls sideways on narrow screens (no wrapping). */
const StageChips: React.FC<Props> = ({ stage }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      testID="booking-stage-chips"
    >
      {STAGES.map((key, index) => {
        const active = key === stage || (stage === 'home' && key === 'pickup');
        // T-575: labels read at render time, in the active language.
        const label = BOOKING_COPY.stages[key];
        return (
          <Chip
            key={key}
            label={BOOKING_COPY.stageChip(index + 1, label)}
            selected={active}
            accessibilityLabel={BOOKING_COPY.stageA11y(index + 1, STAGES.length, label, active)}
          />
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // Bleeds to the sheet edges so chips scroll off-screen instead of being cut at the padding.
  scroll: { marginHorizontal: -space[4] },
  row: { gap: space[2], paddingHorizontal: space[4] },
});

export default StageChips;
