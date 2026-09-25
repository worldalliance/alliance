import tseslint from "typescript-eslint";
import apiClientRules from "./eslint/api-client-rules.mjs";
import sharedRules from "./eslint/shared-rules.mjs";

export default tseslint.config([
  ...tseslint.configs.recommended,
  sharedRules,
  ...apiClientRules.map((config) => ({
    ...config,
    files: ["shared/**/*.{ts,tsx}", "sharedweb/**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
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
