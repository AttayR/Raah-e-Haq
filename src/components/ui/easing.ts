import { Easing, type EasingFunction, type EasingFunctionFactory } from 'react-native-reanimated';
import type { EasingToken, TimingToken } from '../../theme';

/** Turns a motion easing descriptor (src/theme/motion.ts) into a Reanimated easing. */
export function toEasing(token: EasingToken): EasingFunction | EasingFunctionFactory {
  switch (token.kind) {
    case 'linear':
      return Easing.linear;
    case 'out':
      return Easing.out(token.curve === 'quad' ? Easing.quad : Easing.cubic);
    case 'bezier':
      return Easing.bezier(token.x1, token.y1, token.x2, token.y2);
  }
}

/** `withTiming` config from a motion token. */
export const timing = (token: TimingToken) => ({ duration: token.duration, easing: toEasing(token.easing) });
