import tseslint from "typescript-eslint";
import eslintPluginExample from "./eslint/eslint-local-rules.mjs";
import sharedRules from "./eslint/shared-rules.mjs";

export default tseslint.config([
  ...tseslint.configs.recommended,
  sharedRules,
  {
    plugins: { "local-rules": eslintPluginExample },
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "local-rules/enforce-foo-bar": "error",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: ["@alliance/shared/*"],
        },
      ],
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: ["apps/frontend/tsconfig.json"],
        },
      },
    },
  },
]);
