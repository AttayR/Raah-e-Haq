import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../../components/ui/IconButton';
import { layout, space } from '../../../theme';
import { MAP_TOP_CONTROLS_HEIGHT } from '../../ride-booking/components/MapTopControls';
import { ACTIVE_RIDE_COPY } from '../copy';

type Props = {
  /** True after the passenger panned or zoomed the ride map: the button shows. */
  visible: boolean;
  onPress: () => void;
};

/**
 * T-549: the passenger moved the map during the ride, so it stopped following the car. This
 * floating button (below the top controls, at the end edge, like DriverRide's recentre) fits
 * the ride again and resumes following.
 */
export const RideRecentreButton: React.FC<Props> = ({ visible, onPress }) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + space[2] + MAP_TOP_CONTROLS_HEIGHT, end: layout.gutter + insets.right }]}
    >
      <IconButton
        testID="ride-recentre"
        variant="floating"
        icon="navigate"
        iconColor="primaryText"
        accessibilityLabel={ACTIVE_RIDE_COPY.recentreA11y}
        onPress={onPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
});

export default RideRecentreButton;
