import React, { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { Keyboard, Platform, ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { space } from '../../theme';

/**
 * Keeps the focused form field visible above the keyboard and any sticky footer (T-545).
 *
 * `KeyboardAvoidingView` (iOS) and `adjustResize` (Android) shrink the screen, but a ScrollView
 * keeps its offset, so a field near the end (a bio, a date of birth above a sticky Save bar)
 * stays hidden under the keyboard. Inside a `KeyboardAwareScrollView` (or a `Screen scroll`),
 * every kit `TextField` reports itself here: on focus once the keyboard is up, when its own
 * height changes while focused (a field error appearing as you type) and when a new error
 * appears (the first errored field is brought into view after a Save). The whole field (label,
 * input, helper or error) is scrolled just inside the visible part of the scroll view, with
 * `REVEAL_MARGIN` to spare; a field already visible does not move.
 */

/** Space kept between the field and the visible edge (keyboard, sticky footer, header). */
export const REVEAL_MARGIN = space[3];
/** Wait after the keyboard settles so the KeyboardAvoidingView has applied its padding. */
export const REVEAL_DELAY_MS = 60;

type Measurable = Pick<View, 'measureInWindow' | 'measureLayout'>;

/**
 * What the controller needs from a ScrollView (RN's or Reanimated's instance). At runtime the
 * ref is the native host instance with the ScrollView methods added, so it also measures; the
 * public types leave `measureInWindow` out, hence optional and checked before use.
 */
export type RevealScrollable = {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  measureInWindow?: View['measureInWindow'];
};

export type KeyboardReveal = {
  /** A field gained focus. */
  focus: (target: Measurable | null) => void;
  /** A field lost focus. */
  blur: (target: Measurable | null) => void;
  /** A field's height changed (error or helper shown, multiline grew). */
  layoutChanged: (target: Measurable | null) => void;
  /** A field just got an error: brought into view, first one per render wins. */
  error: (target: Measurable | null) => void;
};

export const KeyboardRevealContext = createContext<KeyboardReveal | null>(null);

/** The enclosing reveal controller, or null outside a keyboard-aware scroll view. */
export const useKeyboardReveal = () => useContext(KeyboardRevealContext);

type Span = { top: number; bottom: number };

/**
 * Where the scroll view should move to show `field` inside `viewport` (both in window
 * coordinates), or null when it is already visible. A field taller than the viewport is
 * aligned to the top.
 */
export function revealOffset({
  offset,
  field,
  viewport,
  margin = REVEAL_MARGIN,
}: {
  offset: number;
  field: Span;
  viewport: Span;
  margin?: number;
}): number | null {
  const top = viewport.top + margin;
  const bottom = viewport.bottom - margin;
  let delta = 0;
  if (field.bottom - field.top > bottom - top || field.top < top) {
    delta = field.top - top;
  } else if (field.bottom > bottom) {
    delta = field.bottom - bottom;
  }
  if (Math.abs(delta) < 1) return null;
  return Math.max(0, offset + delta);
}

type Rect = { x: number; y: number; width: number; height: number };

const inWindow = (view: Pick<View, 'measureInWindow'>) =>
  new Promise<Rect>((resolve) => view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height })));

/** The ScrollView's content view (RN keeps it on the instance; not in the public types). */
const innerViewOf = (scroll: RevealScrollable): Parameters<View['measureLayout']>[0] | null => {
  const withInner = scroll as RevealScrollable & { getInnerViewRef?: () => Parameters<View['measureLayout']>[0] | null };
  return typeof withInner.getInnerViewRef === 'function' ? withInner.getInnerViewRef() : null;
};

const contentY = (target: Measurable, inner: Parameters<View['measureLayout']>[0]) =>
  new Promise<number | null>((resolve) =>
    target.measureLayout(
      inner,
      (_x, y) => resolve(y),
      () => resolve(null),
    ),
  );

/** Measures `target` against `scroll` and scrolls it into view when it is hidden. */
export async function revealInScroll(scroll: RevealScrollable, target: Measurable, os: string = Platform.OS) {
  const inner = innerViewOf(scroll);
  const measureScroll = scroll.measureInWindow;
  if (!inner || typeof measureScroll !== 'function') return;
  const [y, field, viewport] = await Promise.all([
    contentY(target, inner),
    inWindow(target),
    inWindow({ measureInWindow: measureScroll.bind(scroll) }),
  ]);
  if (y === null || viewport.height <= 0) return;
  // Content top in the window = field top − its y in the content; the offset is how far that is above the viewport.
  const offset = viewport.y - (field.y - y);
  let bottom = viewport.y + viewport.height;
  // iOS reports the keyboard in window points; keep clear of it too when nothing avoided it.
  const keyboardTop = os === 'ios' && Keyboard.isVisible() ? Keyboard.metrics()?.screenY : undefined;
  if (keyboardTop !== undefined && keyboardTop > viewport.y) bottom = Math.min(bottom, keyboardTop);
  const next = revealOffset({
    offset,
    field: { top: field.y, bottom: field.y + field.height },
    viewport: { top: viewport.y, bottom },
  });
  if (next !== null) scroll.scrollTo({ y: next, animated: true });
}

/** The controller behind `KeyboardRevealProvider`; `getScroll` returns the mounted ScrollView. */
export function useKeyboardRevealController(getScroll: () => RevealScrollable | null): KeyboardReveal {
  const focused = useRef<Measurable | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorQueued = useRef(false);
  const getScrollRef = useRef(getScroll);
  getScrollRef.current = getScroll;

  const schedule = useCallback((target: Measurable) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      errorQueued.current = false;
      const scroll = getScrollRef.current();
      if (scroll) revealInScroll(scroll, target).catch(() => undefined);
    }, REVEAL_DELAY_MS);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      if (focused.current) schedule(focused.current);
    });
    return () => {
      show.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  return useMemo<KeyboardReveal>(
    () => ({
      focus: (target) => {
        focused.current = target;
        // Otherwise keyboardDidShow reveals it once the screen has made room.
        if (target && Keyboard.isVisible()) schedule(target);
      },
      blur: (target) => {
        if (focused.current === target) focused.current = null;
      },
      layoutChanged: (target) => {
        if (target && focused.current === target && Keyboard.isVisible() && !errorQueued.current) schedule(target);
      },
      error: (target) => {
        if (!target || errorQueued.current) return;
        errorQueued.current = true;
        schedule(target);
      },
    }),
    [schedule],
  );
}

type ProviderProps = React.PropsWithChildren<{ getScroll: () => RevealScrollable | null }>;

/** Gives the kit `TextField`s inside a scroll view their reveal controller. */
export function KeyboardRevealProvider({ getScroll, children }: ProviderProps) {
  const reveal = useKeyboardRevealController(getScroll);
  return <KeyboardRevealContext.Provider value={reveal}>{children}</KeyboardRevealContext.Provider>;
}

type GroupProps = React.PropsWithChildren<{ style?: ViewProps['style']; testID?: string }>;

/**
 * T-556 (QA 2026-10-16 #25): a section whose heading must stay in view with its field. Fields
 * inside report the whole group (heading, field and the field's suggestions) to the enclosing
 * reveal, so revealing scrolls the group's top into view, not just the field, whose list would
 * otherwise push the heading out above the sheet. A new error still reveals the field itself.
 * Without an enclosing controller it is a plain View.
 */
export function KeyboardRevealGroup({ style, testID, children }: GroupProps) {
  const parent = useKeyboardReveal();
  const groupRef = useRef<View | null>(null);
  const value = useMemo<KeyboardReveal | null>(() => {
    if (!parent) return null;
    const asGroup = (target: Measurable | null): Measurable | null => (target ? groupRef.current ?? target : null);
    return {
      focus: (target) => parent.focus(asGroup(target)),
      blur: (target) => parent.blur(asGroup(target)),
      layoutChanged: (target) => parent.layoutChanged(asGroup(target)),
      error: (target) => parent.error(target),
    };
  }, [parent]);
  return (
    <View ref={groupRef} style={style} testID={testID}>
      <KeyboardRevealContext.Provider value={value}>{children}</KeyboardRevealContext.Provider>
    </View>
  );
}

/**
 * A ScrollView for forms (T-545): taps reach buttons while the keyboard is up, dragging dismisses
 * it, and the focused kit `TextField` (with its error) is kept above the keyboard and any sticky
 * footer outside the scroll view. Use it inside `<Screen keyboardAvoiding>` for a form with a
 * bottom action bar; `Screen scroll` already includes it.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(
  { children, keyboardShouldPersistTaps = 'handled', keyboardDismissMode, ...props },
  ref,
) {
  const local = useRef<ScrollView | null>(null);
  const setRef = useCallback(
    (node: ScrollView | null) => {
      local.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const getScroll = useCallback(() => local.current, []);
  return (
    <ScrollView
      ref={setRef}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
      {...props}
    >
      <KeyboardRevealProvider getScroll={getScroll}>{children}</KeyboardRevealProvider>
    </ScrollView>
  );
});
