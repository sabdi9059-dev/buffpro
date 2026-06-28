module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
  overrides: [
    {
      // Server-side Vercel functions run in Node, not the browser.
      files: ['api/**/*.ts'],
      env: { node: true, browser: false },
      rules: {
        'no-undef': 'off', // TypeScript + Node types cover globals
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
