import localRules from './eslint/eslint-local-rules.mjs';
import tseslint from 'typescript-eslint';
import eslintNestJs from '@darraghor/eslint-plugin-nestjs-typed';
import parser from '@typescript-eslint/parser';
import sharedRules from '../eslint/shared-rules.mjs';

export default tseslint.config([
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintNestJs.configs.flatRecommended,
  sharedRules,
  {
    plugins: { 'local-rules': localRules },
    files: ['**/*.ts'],
    rules: {
      '@darraghor/nestjs-typed/controllers-should-supply-api-tags': 'off',
      // `checkLazyOptional` is off while the un-migrated entities are drained.
      // Drain them by re-running the rule with the option forced back on —
      // repeat the options, since `--rule` with a bare severity keeps the ones
      // configured here:
      // `eslint --rule '{"local-rules/relation-optionality":["error",{"checkLazyOptional":true}]}' --fix`
      'local-rules/relation-optionality': [
        'error',
        { checkLazyOptional: false },
      ],
      // Same deal for columns — see docs/entity-column-nullability.md, which
      // has the drain command and the remaining slices.
      'local-rules/column-optionality': [
        'error',
        { checkOptional: false, checkMissingNull: false },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: ['@nestjs/mapped-types'],
        },
      ],
    },
  },
]);
