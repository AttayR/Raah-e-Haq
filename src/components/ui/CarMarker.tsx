import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import { Icon } from './Icon';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius } from '../../theme';

/** Diameter of the car badge drawn on the map. */
export const CAR_MARKER_SIZE = 32;

/**
 * Car badge for map markers (DESIGN_SYSTEM 5.21): `driverMarker` body with a 2 pt ring in
 * `surface`, car glyph in `surface`. `muted` is the nearby-driver look (60% opacity).
 */
export const CarMarkerGlyph: React.FC<{ muted?: boolean; testID?: string }> = ({ muted = false, testID }) => {
  const { theme } = useAppTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          backgroundColor: theme.colors.driverMarker,
          borderColor: theme.colors.surface,
        },
        muted ? styles.muted : null,
      ]}
    >
      <Icon name="car" size={20} color="surface" />
    </View>
  );
};

/** How long a marker re-renders its custom view before it is frozen (icon fonts load first). */
export const CAR_MARKER_SETTLE_MS = 1000;

type Props = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  /** Heading in degrees, when known. */
  rotation?: number;
  muted?: boolean;
  testID?: string;
};

/**
 * Map marker with the car badge. Custom marker views are snapshotted on iOS Google Maps, so
 * the view is tracked briefly (until the glyph has drawn) and then frozen for performance.
 */
export const CarMarker: React.FC<Props> = ({ coordinate, title, description, rotation, muted, testID }) => {
  const { theme } = useAppTheme();
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const t = setTimeout(() => setTracks(false), CAR_MARKER_SETTLE_MS);
    return () => clearTimeout(t);
  }, [theme.mode, muted]);
  return (
    <Marker
      testID={testID}
      coordinate={coordinate}
      title={title}
      description={description}
      rotation={rotation}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
    >
      <CarMarkerGlyph muted={muted} testID={testID ? `${testID}-glyph` : undefined} />
    </Marker>
  );
};

const styles = StyleSheet.create({
  muted: { opacity: 0.6 },
  badge: {
    width: CAR_MARKER_SIZE,
    height: CAR_MARKER_SIZE,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CarMarker;
