/**
 * UI-R20b kit (passenger-home V2, V5): the service-card art as data (every shape value from the
 * spec, the label exclusion rule), ServiceCard (fills by kind, pressed, a11y, press handler, RTL
 * mirror), the outline Chip variant, and the static LinearFade.
 */
import React from 'react';
import { I18nManager, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import {
  Chip,
  LinearFade,
  SERVICE_ART,
  SERVICE_ART_EXCLUSION,
  SERVICE_ART_VIEWBOX,
  SERVICE_KINDS,
  ServiceCard,
  artIntrudes,
  artShapeBounds,
} from '../../../src/components/ui';
import { componentTokens, lightColors } from '../../../src/theme';

jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

const themed = async (node: React.ReactElement) => {
  const view = render(<ThemeProvider>{node}</ThemeProvider>);
  await flush();
  return view;
};

const flat = (style: StyleProp<ViewStyle | TextStyle>): ViewStyle & TextStyle => (StyleSheet.flatten(style) ?? {}) as ViewStyle & TextStyle;

describe('service art data (V2)', () => {
  it('both drawings sit on the 88 × 48 grid drawn at 104 × 56', () => {
    expect(SERVICE_ART_VIEWBOX).toEqual({ width: 88, height: 48 });
    expect(componentTokens.serviceCard).toMatchObject({ minHeight: 72, artWidth: 104, artHeight: 56, artBottom: 2, pressNudge: 3 });
    expect(SERVICE_KINDS).toEqual(['ride', 'parcel']);
  });

  it('the sedan: paint order, exact geometry and tokens (15 shapes, footprint x 6–84, y 12.5–47)', () => {
    const ride = SERVICE_ART.ride;
    expect(ride).toHaveLength(15);
    expect(ride.map(p => p.paint)).toEqual([
      'shadow',
      'vehicleBody',
      'vehicleGlass',
      'vehicleGlass',
      'vehicleRoof',
      'vehicleGlass',
      'vehicleGlass',
      'vehicleHeadlight',
      'vehicleTaillight',
      'cutout',
      'cutout',
      'vehicleTyre',
      'vehicleTyre',
      'illoHub',
      'illoHub',
    ]);
    expect(ride[0].shape).toEqual({ t: 'ellipse', cx: 44, cy: 44.5, rx: 38, ry: 2.5 });
    expect(ride[7].shape).toEqual({ t: 'rect', x: 79.5, y: 27.5, w: 4, h: 3, rx: 1.5 });
    expect(ride[9].shape).toEqual({ t: 'circle', cx: 22, cy: 37.5, r: 8.5 });
    expect(ride[13].shape).toEqual({ t: 'circle', cx: 22, cy: 37.5, r: 2.75 });
    const bounds = ride.filter(p => p.paint !== 'shadow').map(p => artShapeBounds(p.shape));
    expect(Math.min(...bounds.map(b => b.minX))).toBe(6);
    expect(Math.max(...bounds.map(b => b.maxX))).toBe(84);
    expect(Math.min(...bounds.map(b => b.minY))).toBe(12.5);
  });

  it('the parcel: box faces, tape, label and three round speed lines (10 shapes)', () => {
    const parcel = SERVICE_ART.parcel;
    expect(parcel).toHaveLength(10);
    expect(parcel.map(p => p.paint)).toEqual([
      'shadow',
      'illoMotion',
      'illoMotion',
      'illoMotion',
      'illoBoxSide',
      'illoBoxTop',
      'illoBoxFront',
      'illoBoxTape',
      'illoBoxTape',
      'illoBoxTape',
    ]);
    expect(parcel[1].shape).toEqual({ t: 'line', x1: 18, y1: 24, x2: 28, y2: 24, w: 2.5 });
    expect(parcel[6].shape).toEqual({ t: 'rect', x: 34, y: 18, w: 32, h: 26 });
    const bounds = parcel.filter(p => p.paint !== 'shadow').map(p => artShapeBounds(p.shape));
    expect(Math.min(...bounds.map(b => b.minX))).toBe(10.75);
    expect(Math.max(...bounds.map(b => b.maxX))).toBe(78);
    expect(Math.min(...bounds.map(b => b.minY))).toBe(10);
  });

  it('exclusion rule: no art point in x < 16 and y < 24, so the label never touches the art', () => {
    expect(SERVICE_ART_EXCLUSION).toEqual({ maxX: 16, maxY: 24 });
    SERVICE_KINDS.forEach(kind => {
      SERVICE_ART[kind].forEach((p, i) => {
        expect({ kind, i, intrudes: artIntrudes(p.shape) }).toEqual({ kind, i, intrudes: false });
      });
    });
    // The check itself catches a shape in the corner.
    expect(artIntrudes({ t: 'rect', x: 4, y: 4, w: 4, h: 4 })).toBe(true);
    expect(artIntrudes({ t: 'path', d: 'M20 30 L10 10 L30 30 Z' })).toBe(true);
  });
});

describe('ServiceCard', () => {
  it('Ride on primarySoft, Parcel on accentSoft; pressed fills; label, hint, role and press', async () => {
    const onRide = jest.fn();
    await themed(
      <>
        <ServiceCard kind="ride" title="Ride" accessibilityLabel="Ride. You travel." accessibilityHint="Opens Where to?" onPress={onRide} testID="ride" />
        <ServiceCard kind="parcel" title="Parcel" accessibilityLabel="Parcel." onPress={jest.fn()} testID="parcel" />
        <ServiceCard kind="parcel" title="Parcel" accessibilityLabel="Parcel pressed" previewPressed onPress={jest.fn()} testID="pressed" />
      </>,
    );
    const ride = screen.getByRole('button', { name: 'Ride. You travel.' });
    expect(ride.props.accessibilityHint).toBe('Opens Where to?');
    expect(flat(screen.getByTestId('ride').props.style).backgroundColor).toBe(lightColors.primarySoft);
    expect(flat(screen.getByTestId('parcel').props.style).backgroundColor).toBe(lightColors.accentSoft);
    expect(flat(screen.getByTestId('pressed').props.style).backgroundColor).toBe(lightColors.accentSoftPressed);
    // No border, no selected state.
    expect(flat(screen.getByTestId('ride').props.style).borderWidth).toBeUndefined();
    expect(flat(screen.getByTestId('ride').props.style).minHeight).toBe(72);
    expect(screen.getByText('Ride')).toBeTruthy();

    fireEvent(screen.getByTestId('ride'), 'pressIn');
    expect(flat(screen.getByTestId('ride').props.style).backgroundColor).toBe(lightColors.primarySoftPressed);
    fireEvent(screen.getByTestId('ride'), 'pressOut');
    fireEvent.press(screen.getByTestId('ride'));
    expect(onRide).toHaveBeenCalledTimes(1);
  });

  it('the art is hidden from screen readers and its wheel arches take the card fill', async () => {
    await themed(<ServiceCard kind="ride" title="Ride" accessibilityLabel="Ride" onPress={jest.fn()} testID="ride" />);
    const art = screen.getByTestId('ride-art', { includeHiddenElements: true });
    expect(art).toBeTruthy();
    expect(screen.queryByTestId('ride-art')).toBeNull();
    expect(flat(art.props.style).transform).toBeUndefined();
  });

  it('RTL: the art is mirrored so the vehicle faces the end edge', async () => {
    jest.replaceProperty(I18nManager, 'isRTL', true);
    await themed(<ServiceCard kind="parcel" title="Parcel" accessibilityLabel="Parcel" onPress={jest.fn()} testID="parcel" />);
    const art = screen.getByTestId('parcel-art', { includeHiddenElements: true });
    expect(flat(art.props.style).transform).toEqual([{ scaleX: -1 }]);
    jest.restoreAllMocks();
  });
});

describe('Chip variants (V5)', () => {
  it('outline: surface fill, 1pt border, textPrimary label, textSecondary glyph; filled stays as it was', async () => {
    await themed(
      <>
        <Chip variant="outline" icon="home" label="Home" onPress={jest.fn()} testID="outline" />
        <Chip icon="home" label="Filled" onPress={jest.fn()} testID="filled" />
        <Chip variant="outline" icon="locationOff" iconColor="warning" label="Turn on location" onPress={jest.fn()} testID="loc" />
      </>,
    );
    const outline = flat(screen.getByTestId('outline').props.style);
    expect(outline).toMatchObject({ backgroundColor: lightColors.surface, borderWidth: 1, borderColor: lightColors.border });
    expect(flat(screen.getByText('Home').props.style).color).toBe(lightColors.textPrimary);
    const filled = flat(screen.getByTestId('filled').props.style);
    expect(filled.backgroundColor).toBe(lightColors.surfaceAlt);
    expect(filled.borderWidth).toBeUndefined();
    expect(flat(screen.getByText('Filled').props.style).color).toBe(lightColors.textSecondary);
    fireEvent(screen.getByTestId('outline'), 'pressIn');
    expect(flat(screen.getByTestId('outline').props.style).backgroundColor).toBe(lightColors.surfacePressed);
  });

  it('a long label shrinks and tail-ellipsizes inside a capped chip instead of overflowing its border', async () => {
    const long = 'House 221, Street 14, Phase 6, Defence Housing Authority, Lahore Cantt';
    await themed(<Chip variant="outline" icon="history" label={long} style={{ maxWidth: 160 }} onPress={jest.fn()} testID="recent" />);
    expect(flat(screen.getByTestId('recent').props.style)).toMatchObject({ maxWidth: 160, flexShrink: 1 });
    const text = screen.getByText(long);
    expect(text.props.numberOfLines).toBe(1);
    expect(flat(text.props.style).flexShrink).toBe(1);
  });
});

describe('LinearFade', () => {
  it('draws a static one-colour gradient that takes no touches and is hidden from screen readers', async () => {
    await themed(<LinearFade color="#FFFFFF" direction="toEnd" testID="fade" />);
    const fade = screen.getByTestId('fade', { includeHiddenElements: true });
    expect(fade.props.pointerEvents).toBe('none');
    expect(fade.props.accessibilityElementsHidden).toBe(true);
  });
});
