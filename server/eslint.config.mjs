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
      // Drain them with
      // `eslint --rule '{"local-rules/relation-optionality":"error"}' --fix`,
      // then flip it on and delete the option.
      'local-rules/relation-optionality': [
        'error',
        { checkLazyOptional: false },
      ],
      // Same deal for columns — see docs/entity-column-nullability.md. Drain
      // with `eslint --rule '{"local-rules/column-optionality":"error"}' --fix`
      // per phase, then flip these on and delete the options.
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
