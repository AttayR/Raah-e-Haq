import React, { memo, useId } from 'react';
import { I18nManager, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type LinearFadeProps = {
  /** The colour that fades (a theme token value, e.g. `surface`). */
  color: string;
  /**
   * `toEnd`: transparent at the start edge, `toOpacity` at the end edge (mirrors in RTL).
   * `down`: `fromOpacity` at the top, `toOpacity` at the bottom.
   */
  direction: 'toEnd' | 'down';
  fromOpacity?: number;
  toOpacity?: number;
  /** Size and position of the fade box (it fills it). */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A static one-colour gradient (UI-R20b: the Home chip row's trailing fade and the map's
 * status-bar scrim): react-native-svg `LinearGradient`, never animated, never re-rendered by its
 * parent's state (memoised on primitives), no touches (`pointerEvents="none"`), hidden from
 * screen readers.
 */
function LinearFadeBase({ color, direction, fromOpacity = 0, toOpacity = 1, style, testID }: LinearFadeProps) {
  const id = `fade${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const horizontal = direction === 'toEnd';
  const rtl = horizontal && I18nManager.isRTL;
  return (
    <View
      style={[styles.box, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Svg width="100%" height="100%" accessible={false}>
        <Defs>
          <LinearGradient
            id={id}
            x1={rtl ? '1' : '0'}
            y1="0"
            x2={horizontal ? (rtl ? '0' : '1') : '0'}
            y2={horizontal ? '0' : '1'}
          >
            <Stop offset="0" stopColor={color} stopOpacity={fromOpacity} />
            <Stop offset="1" stopColor={color} stopOpacity={toOpacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export const LinearFade = memo(LinearFadeBase);

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});

export default LinearFade;
