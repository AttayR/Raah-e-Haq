import { I18nManager, Platform } from 'react-native';

/**
 * Semantic icon names -> MaterialCommunityIcons (MDI) glyphs (DESIGN_SYSTEM §4, v1.1). Screens
 * say `<Icon name="pickup" />`, never a glyph name. Every value is checked against the bundled
 * MDI glyph map at type level (`MdiGlyph`), so a misspelt or missing glyph fails type-check
 * instead of rendering a "?" box. Outline glyphs by default; filled only for an active tab or a
 * status glyph.
 *
 * The MDI version shipped with react-native-vector-icons 10.3 has no `receipt-text(-outline)`,
 * so the Activity tab uses `clipboard-text-clock(-outline)`.
 */
export type MdiGlyph = keyof typeof import('react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json');

/** The back glyph differs per platform (§4): chevron on iOS, arrow on Android. */
export const backGlyph = (os: typeof Platform.OS = Platform.OS): MdiGlyph =>
  os === 'android' ? 'arrow-left' : 'chevron-left';

export const iconGlyphs = {
  // Navigation and chrome.
  back: backGlyph(),
  chevronEnd: 'chevron-right',
  chevronDown: 'chevron-down',
  close: 'close',
  clear: 'close-circle',
  more: 'dots-vertical',
  search: 'magnify',
  settings: 'cog-outline',
  // Tabs (§8.1): outline inactive, filled active.
  home: 'home-outline',
  homeActive: 'home',
  activity: 'clipboard-text-clock-outline',
  activityActive: 'clipboard-text-clock',
  inbox: 'inbox-outline',
  inboxActive: 'inbox',
  accountCircle: 'account-circle-outline',
  accountCircleActive: 'account-circle',
  steering: 'steering',
  wallet: 'wallet-outline',
  walletActive: 'wallet',
  // People and communication.
  account: 'account-outline',
  bell: 'bell-outline',
  chat: 'message-text-outline',
  phone: 'phone-outline',
  email: 'email-outline',
  send: 'send',
  // Vehicles (§4: unknown keys fall back to `car`).
  car: 'car-side',
  bike: 'motorbike',
  rickshaw: 'rickshaw',
  van: 'van-passenger',
  rides: 'car-side',
  // UI-R5: map car marker (§5.21 names MDI `car`).
  carMarker: 'car',
  // Map and places.
  pin: 'map-marker',
  origin: 'radiobox-marked',
  locate: 'crosshairs-gps',
  locationOff: 'map-marker-off-outline',
  distance: 'map-marker-distance',
  navigate: 'navigation-variant-outline',
  work: 'briefcase-outline',
  bookmark: 'bookmark-outline',
  history: 'history',
  swap: 'swap-vertical',
  // Money.
  cash: 'cash',
  promo: 'tag-outline',
  savings: 'piggy-bank-outline',
  // Status and feedback.
  check: 'check-circle',
  // UI-R2: bare tick for selected chips and checkboxes (§5.11).
  checkMark: 'check',
  info: 'information-outline',
  warning: 'alert-circle-outline',
  // UI-R3 feedback: the bundled MDI has no `cloud-alert-outline` (§5.20), so the network error
  // uses the outline `cloud-off-outline`; the Toast warning tone uses the triangle.
  networkError: 'cloud-off-outline',
  alertTriangle: 'alert-outline',
  offline: 'wifi-off',
  help: 'help-circle-outline',
  shield: 'shield-check-outline',
  star: 'star',
  starOutline: 'star-outline',
  clock: 'clock-outline',
  calendar: 'calendar-blank-outline',
  // Ride flow (UI-R5): slide-to-confirm knob (§5.31).
  slideConfirm: 'chevron-double-right',
  // Actions.
  add: 'plus',
  edit: 'pencil-outline',
  delete: 'trash-can-outline',
  refresh: 'refresh',
  retry: 'refresh',
  upload: 'file-upload-outline',
  // Profile photo (T-504).
  camera: 'camera-outline',
  photoLibrary: 'image-multiple-outline',
  // UI-R15: photo placeholder (parcel pickup photo while loading or failed).
  image: 'image-outline',
  document: 'file-document-outline',
  lock: 'lock-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  logout: 'logout',
  power: 'power',
  theme: 'theme-light-dark',
  // Language setting (T-523).
  language: 'translate',
  // Wallet and earnings (T-508/T-507).
  moneyIn: 'arrow-bottom-left',
  moneyOut: 'arrow-top-right',
  receipt: 'receipt',
  bank: 'bank-outline',
  chart: 'chart-bar',
  refund: 'cash-refund',
  pending: 'clock-outline',
  // Wallet top-up (T-515).
  topUp: 'wallet-plus-outline',
  card: 'credit-card-outline',
  mobileWallet: 'cellphone',
  failed: 'close-circle-outline',
  // Safety (T-520).
  sos: 'shield-alert-outline',
  share: 'share-variant-outline',
  shareOff: 'share-off-outline',
  contacts: 'account-group-outline',
  addContact: 'account-plus-outline',
  police: 'police-badge-outline',
  ambulance: 'ambulance',
  sms: 'message-alert-outline',
  pinCode: 'dialpad',
  lockClock: 'lock-clock',
  support: 'lifebuoy',
  // Fare fairness (T-521).
  minus: 'minus',
  fareLock: 'lock-check-outline',
  waiting: 'timer-sand',
  report: 'flag-outline',
  statement: 'calendar-week',
  dispute: 'scale-balance',
  // AC tier and women mode (T-522).
  ac: 'snowflake',
  womenMode: 'face-woman-outline',
  // Parcel delivery (T-522, BE-88).
  parcel: 'package-variant-closed',
  // T-533: the legacy MaterialIcons glyphs (auth, registration, error boundaries), so only the
  // MDI font ships.
  chevronUp: 'chevron-up',
  arrowBack: 'arrow-left',
  arrowForward: 'arrow-right',
  error: 'alert-circle',
  verified: 'shield-check',
  smartphone: 'cellphone',
  idCard: 'card-account-details-outline',
  addPhoto: 'camera-plus-outline',
  map: 'map-outline',
  paused: 'pause-circle',
  blocked: 'cancel',
  admin: 'shield-account-outline',
  // UI-R7 role choice cards: trailing radio.
  radioOn: 'radiobox-marked',
  radioOff: 'radiobox-blank',
} as const satisfies Record<string, MdiGlyph>;

export type IconName = keyof typeof iconGlyphs;

/** Glyphs that point along the reading direction and mirror in RTL (§7, §12.8). */
export const directionalIcons: ReadonlySet<IconName> = new Set<IconName>([
  'back',
  'chevronEnd',
  'send',
  'slideConfirm',
  'arrowBack',
  'arrowForward',
]);

/** Whether `name` should render mirrored for the given layout direction. */
export const shouldMirrorIcon = (name: IconName, isRTL: boolean = I18nManager.isRTL): boolean =>
  isRTL && directionalIcons.has(name);
