import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// This is just an example default config for ESLint.
// You should change it to your needs following the documentation.
export default tseslint.config(
  {
    ignores: ['**/build/**', '**/tmp/**', '**/coverage/**', '**/dist/**'],
  },
  eslint.configs.recommended,
  eslintConfigPrettier,
  {
    extends: [...tseslint.configs.recommended],

    files: ['**/*.ts', '**/*.mts'],

    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },

    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-undef': 'off', // TypeScript handles this better
    },

    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',

      globals: {
        ...globals.node,
        ...globals.browser,
        process: true,
        require: true,
        module: true,
        __dirname: true,
        Buffer: true,
        setImmediate: true,
        clearImmediate: true,
        queueMicrotask: true,
      },

      parserOptions: {
        project: ['./tsconfig.json', './__tests__/tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
  },

  // Configuration for JavaScript files
  {
    files: ['**/*.js', '**/*.mjs'],

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },
);
