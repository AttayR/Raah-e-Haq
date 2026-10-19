import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { componentTokens, type ColorMode, type SemanticColors } from '../../../theme';
import { VEHICLE_GLYPHS, vehicleMarkerKind, type GlyphShape, type VehicleMarkerKind } from './vehicleGlyphs';

const m = componentTokens.ride.vehicleMarker;

type Paint = { fill?: string; stroke?: string; strokeWidth?: number };

/** One shape with its paint. A line is always stroked: its own width plus the pass width. */
const renderShape = (shape: GlyphShape, key: string, paint: Paint, passWidth = 0): React.ReactElement => {
  switch (shape.t) {
    case 'rect':
      return <Rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} ry={shape.rx} {...paint} />;
    case 'path':
      return <Path key={key} d={shape.d} {...paint} />;
    case 'circle':
      return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint} />;
    case 'ellipse':
      return <Ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...paint} />;
    case 'line':
      return (
        <Line
          key={key}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={paint.stroke ?? paint.fill}
          strokeWidth={shape.w + passWidth}
          strokeLinecap="round"
        />
      );
  }
};

/**
 * A silhouette pass (§1.4): every outline shape filled and stroked in one colour, with group
 * opacity (so overlapping shapes do not double-darken).
 */
const silhouettePass = (shapes: ReadonlyArray<GlyphShape>, name: string, color: string, width: number, opacity: number) => (
  <G key={name} opacity={opacity}>
    {shapes.map((shape, i) => renderShape(shape, `${name}${i}`, { fill: color, stroke: color, strokeWidth: width }, width))}
  </G>
);

type LayersProps = { kind: VehicleMarkerKind; colors: SemanticColors; mode: ColorMode; transform: string };

/** The paint order of §1.4: outer shadow, inner shadow, casing, then the details. */
const GlyphLayers: React.FC<LayersProps> = ({ kind, colors, mode, transform }) => {
  const drawing = VEHICLE_GLYPHS[kind];
  return (
    <G transform={transform} strokeLinejoin="round" strokeLinecap="round">
      {silhouettePass(drawing.silhouette, 'so', colors.vehicleShadow, m.shadowOuterWidth, m.shadowOuterOpacity[mode])}
      {silhouettePass(drawing.silhouette, 'si', colors.vehicleShadow, m.shadowInnerWidth, m.shadowInnerOpacity[mode])}
      {silhouettePass(drawing.silhouette, 'c', colors.vehicleCasing, m.casingWidth, 1)}
      {drawing.details.map((detail, i) =>
        renderShape(detail.shape, `d${i}`, {
          fill: detail.fill ? colors[detail.fill] : 'none',
          stroke: detail.stroke ? colors[detail.stroke] : undefined,
          strokeWidth: detail.strokeWidth,
        }),
      )}
    </G>
  );
};

/** The 48-unit drawing sits 4 units inside the 56-unit viewBox (shadow and casing never clip). */
const GRID_TRANSFORM = `translate(${m.gridInset} ${m.gridInset})`;

type DrawProps = { kind: VehicleMarkerKind; size: number; assigned: boolean; colors: SemanticColors; mode: ColorMode; testID?: string };

const VehicleGlyphDrawing: React.FC<DrawProps> = ({ kind, size, assigned, colors, mode, testID }) => {
  if (!assigned) {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${m.viewBox} ${m.viewBox}`} testID={testID} accessible={false}>
        <GlyphLayers kind={kind} colors={colors} mode={mode} transform={GRID_TRANSFORM} />
      </Svg>
    );
  }
  // Assigned (§1.6): a 64pt view, the 56pt halo round the pivot, the 48pt glyph centred on it.
  const view = m.assignedViewSize;
  const offset = (view - m.assignedSize) / 2;
  const scale = m.assignedSize / m.viewBox;
  return (
    <Svg width={view} height={view} viewBox={`0 0 ${view} ${view}`} testID={testID} accessible={false}>
      <Circle
        testID={testID ? `${testID}-halo` : undefined}
        cx={view / 2}
        cy={view / 2}
        r={(m.haloSize - m.haloRingWidth) / 2}
        fill={colors.vehicleHalo}
        fillOpacity={m.haloFillOpacity[mode]}
        stroke={colors.vehicleHalo}
        strokeOpacity={m.haloRingOpacity[mode]}
        strokeWidth={m.haloRingWidth}
      />
      <GlyphLayers kind={kind} colors={colors} mode={mode} transform={`translate(${offset} ${offset}) scale(${scale}) ${GRID_TRANSFORM}`} />
    </Svg>
  );
};

const MemoDrawing = React.memo(VehicleGlyphDrawing);
MemoDrawing.displayName = 'VehicleGlyphDrawing';

export type VehicleGlyphProps = {
  /** Backend `vehicle_type`; unknown or missing draws the car. Ignored when `kind` is set. */
  vehicleType?: string | null;
  kind?: VehicleMarkerKind;
  /** Nearby glyph canvas size (pt; default 40). The assigned view is always 64 with a 48 glyph. */
  size?: number;
  /** The assigned vehicle (your driver / the driver's own car): 48pt glyph on a 56pt halo in 64pt. */
  assigned?: boolean;
  testID?: string;
};

/**
 * Top-down vehicle art (T-586, map-vehicles.md §1): react-native-svg, north-up, pivot at the
 * canvas centre, colours from the theme (navy on the light map, light on the dark map). The
 * contact shadow is part of the SVG, never a native shadow (§5.21 b). No raster images.
 */
export const VehicleGlyph: React.FC<VehicleGlyphProps> = ({ vehicleType, kind, size = m.nearbySize, assigned = false, testID }) => {
  const { theme } = useAppTheme();
  return (
    <MemoDrawing
      kind={kind ?? vehicleMarkerKind(vehicleType)}
      size={size}
      assigned={assigned}
      colors={theme.colors}
      mode={theme.mode}
      testID={testID}
    />
  );
};

export default VehicleGlyph;
