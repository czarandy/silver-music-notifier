import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'data/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript already resolves identifiers; no-undef just produces false
      // positives on browser/node globals here.
      'no-undef': 'off',
      // Require braces around all control statements (matches silver-ui).
      curly: 'error',
    },
  },
);
