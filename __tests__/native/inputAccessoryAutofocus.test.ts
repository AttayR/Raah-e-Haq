/**
 * T-551: on Fabric an autoFocus number pad that mounts with its Done bar (the phone sign-in code
 * step, the phone step after "Change phone number", the registration code step) showed no bar.
 * The TextInput becomes first responder in its own didMoveToWindow; the InputAccessoryView
 * attaches afterwards, and the keyboard keeps the input views it read at focus. A patch-package
 * patch makes the bar reload the input views when its input already has focus.
 */
// Module scope, so the helpers below don't clash with other test files' globals.
export {};

// Jest runs from the repository root; paths are relative to it.
const { readFileSync } = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
}>('fs');

const PATCH = 'patches/react-native+0.80.1.patch';
const ACCESSORY =
  'node_modules/react-native/React/Fabric/Mounting/ComponentViews/InputAccessory/RCTInputAccessoryComponentView.mm';

/** The body of `didMoveToWindow` in the installed InputAccessoryView. */
const didMoveToWindow = (): string => {
  const source = readFileSync(ACCESSORY, 'utf8');
  const start = source.indexOf('- (void)didMoveToWindow');
  const end = source.indexOf('- (BOOL)canBecomeFirstResponder', start);
  return source.slice(start, end);
};

describe('InputAccessoryView reaches an input that is already focused (T-551)', () => {
  it('the react-native patch reloads the input views after attaching the bar', () => {
    const patch = readFileSync(PATCH, 'utf8');
    expect(patch).toContain('ComponentViews/InputAccessory/RCTInputAccessoryComponentView.mm');
    expect(patch).toMatch(/^\+\s+if \(_textInput\.isFirstResponder\) \{\n\+\s+\[_textInput reloadInputViews\];/m);
  });

  it('the installed native view carries it, right after the bar is attached by nativeID', () => {
    const body = didMoveToWindow();
    const attach = body.indexOf('_textInput.inputAccessoryView = _contentView;');
    const reload = body.indexOf('[_textInput reloadInputViews];');
    expect(attach).toBeGreaterThan(-1);
    expect(reload).toBeGreaterThan(attach);
    expect(body.slice(attach, reload)).toContain('if (_textInput.isFirstResponder)');
    // Still inside the nativeID branch, not the inline-accessory one.
    expect(body.indexOf('} else {', attach)).toBeGreaterThan(reload);
  });
});
