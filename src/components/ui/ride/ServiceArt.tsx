import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { componentTokens } from '../../../theme';
import { SERVICE_ART, SERVICE_ART_VIEWBOX, type ArtPart, type ServiceKind } from './serviceArtShapes';

export type ServiceArtProps = {
  kind: ServiceKind;
  /** The card's fill: the wheel-arch cut-outs take it (never a hard-coded colour). */
  cutout: string;
  /** RTL: mirror the drawing so the vehicle's front faces the end edge. */
  flip?: boolean;
  testID?: string;
};

const k = componentTokens.serviceCard;
const VIEWBOX = `0 0 ${SERVICE_ART_VIEWBOX.width} ${SERVICE_ART_VIEWBOX.height}`;

/**
 * The Home service-card illustration (UI-R20b, passenger-home V2): a static react-native-svg
 * drawing (no gradients, masks or filters) from `serviceArtShapes.ts`, 104 × 56 pt. The car uses the
 * map vehicles' tokens, so the card car and the map cars are one family. Memoised on a kind, a
 * colour and a boolean: sheet drags, camera moves and nearby polls never re-render it. Hidden
 * from screen readers (the card's label names the service).
 */
function ServiceArtBase({ kind, cutout, flip = false, testID }: ServiceArtProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  const shadowOpacity = k.shadowOpacity[theme.mode];
  const paint = (p: ArtPart): { fill: string; opacity?: number } =>
    p.paint === 'cutout' ? { fill: cutout } : p.paint === 'shadow' ? { fill: c.illoShadow, opacity: shadowOpacity } : { fill: c[p.paint] };

  return (
    <Svg
      width={k.artWidth}
      height={k.artHeight}
      viewBox={VIEWBOX}
      style={flip ? styles.flip : undefined}
      accessible={false}
      testID={testID}
    >
      {SERVICE_ART[kind].map((p, i) => {
        const { fill, opacity } = paint(p);
        const s = p.shape;
        switch (s.t) {
          case 'rect':
            return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} ry={s.rx} fill={fill} opacity={opacity} />;
          case 'path':
            return <Path key={i} d={s.d} fill={fill} opacity={opacity} />;
          case 'circle':
            return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={fill} opacity={opacity} />;
          case 'ellipse':
            return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} opacity={opacity} />;
          case 'line':
            return (
              <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={fill} strokeWidth={s.w} strokeLinecap="round" opacity={opacity} />
            );
        }
      })}
    </Svg>
  );
}

export const ServiceArt = memo(ServiceArtBase);

const styles = StyleSheet.create({
  flip: { transform: [{ scaleX: -1 }] },
});
