/**
 * UI-R19 (docs/design/REFRESH_PLAN.md, DESIGN_SYSTEM §11): the design-system greps are lint
 * errors for product code. Colours, type and icons come from src/theme and src/components/ui;
 * those two folders (the only places allowed to hold raw values) are excluded.
 */
const productCode = ['src/screens/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/config/**/*.{ts,tsx}'];
const designSystem = ['src/components/ui/**', 'src/theme/**'];

const hexOrRgb = '/^(#[0-9A-Fa-f]{3,8}|rgba?\\(.*\\))$/';

module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // App code logs only through src/core/logging/logger.ts, which redacts secrets and PII.
      // Node scripts (scripts/) and tests may print to the console.
      files: ['src/**/*.{js,jsx,ts,tsx}'],
      excludedFiles: ['src/core/logging/logger.ts'],
      rules: {'no-console': 'error'},
    },
    {
      files: productCode,
      excludedFiles: designSystem,
      rules: {
        // §11.3: no colour literals in styles or anywhere else in product code.
        'react-native/no-color-literals': 'error',
        'no-restricted-syntax': [
          'error',
          {
            selector: `Literal[value=${hexOrRgb}]`,
            message: 'Colours come from the theme (useAppTheme().theme.colors), never a hex or rgb literal (DESIGN_SYSTEM §11.3).',
          },
          {
            selector: 'Property[key.name=/^(fontSize|fontWeight|fontFamily|lineHeight)$/][value.type="Literal"]',
            message: 'Type comes from AppText variants or textStyles in src/theme, never a raw value (DESIGN_SYSTEM §11.4).',
          },
        ],
        // §11.6 / §11.9: product dialogs are the kit Dialog (src/core/dialog), not the native Alert.
        'no-restricted-properties': [
          'error',
          {object: 'Alert', property: 'alert', message: 'Use confirm() / alert() from src/core/dialog (DESIGN_SYSTEM §5.15).'},
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['ImageBackground', 'Button', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback'],
                message: 'Use the kit (Button, IconButton, ListItem, Pressable rows) from src/components/ui; no wallpaper backgrounds (DESIGN_SYSTEM §11.6).',
              },
            ],
            patterns: [
              {
                group: ['react-native-vector-icons/*', '!react-native-vector-icons/glyphmaps'],
                message: 'Icons go through the kit Icon (src/components/ui/Icon.tsx), MaterialCommunityIcons only (T-533).',
              },
            ],
          },
        ],
      },
    },
  ],
};
