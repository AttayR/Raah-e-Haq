/**
 * English strings (DESIGN_SYSTEM §7, §12.8), keyed by area. Each UI-R task moves the strings of
 * the screens it touches here; Urdu (`ur.ts`) is added later with the same shape. Placeholders
 * use `{name}` and are filled by `t()`.
 */
export const en = {
  common: {
    tryAgain: 'Try again',
    cancel: 'Cancel',
    done: 'Done',
    close: 'Close',
    back: 'Back',
  },
  format: {
    /** Display label for the server's PKR currency (§2: never "PKR", never "₨"). */
    currencyPKR: 'Rs',
    km: 'km',
    minutes: 'min',
    hours: 'h',
    today: 'Today',
    yesterday: 'Yesterday',
    am: 'AM',
    pm: 'PM',
    weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  kitGallery: {
    title: 'UI kit gallery',
    subtitle: 'Debug builds only. Tokens and components from DESIGN_SYSTEM v1.1.',
    devMenuItem: 'Open UI kit gallery',
    closeA11y: 'Close the UI kit gallery',
    locateA11y: 'Show my location',
    modeLabel: 'Mode: {mode}',
    sectionColors: 'Colour tokens',
    sectionColorsPart: 'Colour tokens ({part}/{count})',
    sectionColorsHint: 'Each token with its contrast pair (AA: 4.5 text, 3 icons and boundaries).',
    sectionType: 'Text styles',
    sectionTypePart: 'Text styles ({part}/{count})',
    sectionSpacing: 'Spacing',
    sectionRadius: 'Radii',
    sectionElevation: 'Elevation',
    sectionComponents: 'Component tokens',
    sectionIcons: 'Icons (MaterialCommunityIcons)',
    sectionIconsPart: 'Icons, MDI ({part}/{count})',
    sectionFormat: 'Formatters',
    sectionHaptics: 'Haptics',
    sectionKit: 'Components',
    hapticsHint: 'Tap to trigger on a device; the simulator has no haptics.',
    contrastOn: 'on {background}',
    pass: 'AA',
    fail: 'Below AA',
    sampleText: 'Where to? Rs 1,250 · 3.4 km',
    swatchSample: 'Aa',
    buttonPrimary: 'Primary',
    buttonSecondary: 'Secondary',
    buttonOutline: 'Outline',
    buttonGhost: 'Ghost',
    buttonDestructive: 'Destructive',
    buttonLoading: 'Loading',
    buttonDisabled: 'Disabled',
  },
} as const;

export type Strings = typeof en;
