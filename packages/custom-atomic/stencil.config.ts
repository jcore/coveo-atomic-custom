import { Config } from '@stencil/core';
import { reactOutputTarget } from '@stencil/react-output-target';
import { readFileSync } from 'fs';
import replacePlugin from '@rollup/plugin-replace';
import path from 'path';
import atImport from 'postcss-import';
import mixins from 'postcss-mixins';
import { inlineSvg } from 'stencil-inline-svg';
import tailwind from 'tailwindcss';
import tailwindNesting from 'tailwindcss/nesting';
import { postcss } from '@stencil/postcss';
import focusVisible from 'postcss-focus-visible';
import autoprefixer from 'autoprefixer';
import postcssNesting from 'postcss-nested';
import alias from '@rollup/plugin-alias';
import html from 'rollup-plugin-html';

const isProduction = true;

function getPackageVersion(): string {
  return JSON.parse(readFileSync('package.json', 'utf-8')).version;
}

function replaceHeadlessMap() {
  return {
    name: 'replace-map-for-headless-dev',
    generateBundle: (options, bundle) => {
      const headlessBundle = Object.keys(bundle).find(bundle => bundle.indexOf('headless.esm') !== -1);
      if (!headlessBundle) {
        return;
      }

      bundle[headlessBundle].map = null;

      bundle[headlessBundle].code += '//# sourceMappingURL=./headless/headless.esm.js.map';
      return bundle;
    },
  };
}

function replace() {
  const env = isProduction ? 'production' : 'development';
  const version = getPackageVersion();
  return replacePlugin({
    'process.env.NODE_ENV': JSON.stringify(env),
    'process.env.VERSION': JSON.stringify(version),
    'preventAssignment': true,
  });
}

const isDevWatch: boolean = process.argv && process.argv.indexOf('--dev') > -1 && process.argv.indexOf('--watch') > -1;

export const config: Config = {
  namespace: 'custom-atomic',
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
      collectionDir: null,
    },
    reactOutputTarget({
      componentCorePackage: '@jcore/custom-atomic',
      proxiesFile: '../custom-atomic-react/lib/components/stencil-generated/index.ts',
      includeDefineCustomElements: true,
      excludeComponents: ['atomic-result-template', 'atomic-recs-result-template', 'atomic-field-condition'],
    }),
  ],
  testing: {
    browserHeadless: 'new',
  },
  plugins: [
    // https://github.com/fabriciomendonca/stencil-inline-svg/issues/16
    inlineSvg(),
    postcss({
      plugins: [atImport(), mixins(), tailwindNesting(), tailwind(), focusVisible(), postcssNesting(), autoprefixer()],
    }),
    replace(),
  ],
  rollupPlugins: {
    before: [
      isDevWatch &&
        alias({
          entries: [
            {
              find: '@coveo/headless/case-assist',
              replacement: path.resolve(__dirname, './src/external-builds/case-assist/headless.esm.js'),
            },
            {
              find: '@coveo/headless/recommendation',
              replacement: path.resolve(__dirname, './src/external-builds/recommendation/headless.esm.js'),
            },
            {
              find: '@coveo/headless/product-recommendation',
              replacement: path.resolve(__dirname, './src/external-builds/product-recommendation/headless.esm.js'),
            },
            {
              find: '@coveo/headless/insight',
              replacement: path.resolve(__dirname, './src/external-builds/insight/headless.esm.js'),
            },
            {
              find: '@coveo/headless',
              replacement: path.resolve(__dirname, './src/external-builds/headless.esm.js'),
            },
          ],
        }),
      html({
        include: 'src/templates/**/*.html',
      }),
      isDevWatch && replaceHeadlessMap(),
    ],
  },
};
