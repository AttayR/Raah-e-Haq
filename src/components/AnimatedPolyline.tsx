import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Easing } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

type LatLng = { latitude: number; longitude: number };

type Props = {
  coordinates: LatLng[];
  durationMs?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

// Progressive drawing polyline: animates revealing the path point-by-point
const AnimatedPolyline: React.FC<Props> = ({ coordinates, durationMs = 1200, strokeColor = '#2563eb', strokeWidth = 5 }) => {
  const [visibleCoords, setVisibleCoords] = useState<LatLng[]>([]);
  const animRef = useRef<number | null>(null);

  // Recompute steps whenever coordinates change
  useEffect(() => {
    if (!coordinates || coordinates.length === 0) {
      setVisibleCoords([]);
      return;
    }

    // cancel previous animation frame
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    // prepare animation state
    const totalPoints = coordinates.length;
    const startTime = Date.now();

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = Easing.out(Easing.cubic)(t);
      const pointsToShow = Math.max(2, Math.round(1 + eased * (totalPoints - 1)));
      setVisibleCoords(coordinates.slice(0, pointsToShow));

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };

    setVisibleCoords([coordinates[0]]);
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
  }, [coordinates, durationMs]);

  if (visibleCoords.length < 2) return null;

  return (
    <Polyline coordinates={visibleCoords as any} strokeWidth={strokeWidth} strokeColor={strokeColor} />
  );
};

export default AnimatedPolyline;


