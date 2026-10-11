import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '../../../components/ui/IconButton';
import { layout, space } from '../../../theme';

/** Height of the control row (48 pt floating buttons) plus its top gap. */
export const MAP_TOP_CONTROLS_HEIGHT = 48 + space[2];

type Props = {
  onBack: () => void;
  onRecenter: () => void;
  /** Hidden while a ride is shown (starting over is not allowed then). */
  onReset?: () => void;
  onOpenAdvanced: () => void;
};

/**
 * Floating map controls below the status bar / Dynamic Island (`insets.top + 8`), never
 * inside it: back at the start edge, recentre, start over and the advanced request at the
 * end edge.
 */
export const MapTopControls: React.FC<Props> = ({ onBack, onRecenter, onReset, onOpenAdvanced }) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="map-top-controls"
      pointerEvents="box-none"
      style={[styles.row, { top: insets.top + space[2], start: layout.gutter + insets.left, end: layout.gutter + insets.right }]}
    >
      <IconButton testID="map-back" variant="floating" icon="back" accessibilityLabel="Back" iconColor="primaryText" onPress={onBack} />
      <View style={styles.trailing} pointerEvents="box-none">
        <IconButton
          testID="map-recenter"
          variant="floating"
          icon="locate"
          iconColor="primaryText"
          accessibilityLabel="Show my location"
          onPress={onRecenter}
        />
        {onReset ? (
          <IconButton testID="map-reset" variant="floating" icon="refresh" iconColor="primaryText" accessibilityLabel="Start over" onPress={onReset} />
        ) : null}
        <IconButton
          testID="map-advanced"
          variant="floating"
          icon="add"
          iconColor="primaryText"
          accessibilityLabel="More ride options"
          onPress={onOpenAdvanced}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trailing: { flexDirection: 'row', gap: space[2] },
});

export default MapTopControls;
