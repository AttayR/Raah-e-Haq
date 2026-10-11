import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from '../ui/Chip';
import { space } from '../../theme';

type Props = {
  stage: 'home' | 'pickup' | 'destination' | 'vehicle' | 'fare' | 'requesting';
};

const STAGES: { key: Props['stage']; label: string }[] = [
  { key: 'pickup', label: 'Pickup' },
  { key: 'destination', label: 'Destination' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'fare', label: 'Fare' },
  { key: 'requesting', label: 'Request' },
];

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
      {STAGES.map((s, index) => {
        const active = s.key === stage || (stage === 'home' && s.key === 'pickup');
        return (
          <Chip
            key={s.key}
            label={`${index + 1}. ${s.label}`}
            selected={active}
            accessibilityLabel={`Step ${index + 1} of ${STAGES.length}: ${s.label}${active ? ', current' : ''}`}
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
