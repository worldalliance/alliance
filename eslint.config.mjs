import tseslint from "typescript-eslint";
import apiClientRules from "./eslint/api-client-rules.mjs";
import sharedRules, {
  envReadsOnlyIn,
  frontendBlockerImport,
  sharedEnvReads,
  webEnvReads,
} from "./eslint/shared-rules.mjs";

export default tseslint.config([
  { ignores: ["agents/desktop/"] },
  ...tseslint.configs.recommended,
  sharedRules,
  envReadsOnlyIn({
    files: ["sharedweb/**/*.{ts,tsx}"],
    ignores: ["sharedweb/lib/env.ts", "sharedweb/**/*.test.{ts,tsx}"],
    ...webEnvReads,
  }),
  envReadsOnlyIn({
    files: ["shared/**/*.{ts,tsx}"],
    ignores: ["shared/**/*.test.{ts,tsx}", "shared/lib/testing/**"],
    ...sharedEnvReads,
  }),
  {
    files: ["sharedweb/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [frontendBlockerImport] }],
    },
  },
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
