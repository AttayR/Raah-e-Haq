import { transformFileSync, transformSync } from '@babel/core';

const source = [
  "console.log('log');",
  "console.info('info');",
  "console.warn('warn');",
  "console.debug('debug');",
  "console.error('error');",
].join('\n');

function compile(envName: string): string {
  const result = transformSync(source, {
    // Jest runs from the project root, so these resolve against it.
    filename: 'src/example.ts',
    configFile: './babel.config.js',
    babelrc: false,
    envName,
  });
  return result?.code ?? '';
}

describe('babel.config.js', () => {
  it('strips console calls except console.error in production', () => {
    const code = compile('production');
    expect(code).not.toMatch(/console\.(log|info|warn|debug)/);
    expect(code).toContain("console.error('error')");
  });

  it('keeps console.error in the release build of the logger', () => {
    // logger.error is the only level that prints in release; it must survive the strip.
    const code =
      transformFileSync('src/core/logging/logger.ts', {
        configFile: './babel.config.js',
        babelrc: false,
        envName: 'production',
      })?.code ?? '';
    // A spread call compiles to `(_console = console).error.apply(...)`.
    expect(code).toMatch(/console\)?\.error(\.apply)?\(/);
  });

  it('keeps every console call outside production', () => {
    const code = compile('development');
    for (const level of ['log', 'info', 'warn', 'debug', 'error']) {
      expect(code).toContain(`console.${level}('${level}')`);
    }
  });

  it('uses the worklets plugin, not the deprecated reanimated one', () => {
    type BabelConfigFactory = (api: { env: (name: string) => boolean }) => { plugins: unknown[] };
    const factory = jest.requireActual<BabelConfigFactory>('../../babel.config.js');
    for (const isProd of [true, false]) {
      const { plugins } = factory({ env: name => isProd && name === 'production' });
      expect(plugins[plugins.length - 1]).toBe('react-native-worklets/plugin');
      expect(plugins).not.toContain('react-native-reanimated/plugin');
    }
  });
});
