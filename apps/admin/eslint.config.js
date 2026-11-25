import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import apiClientRules from "../../eslint/api-client-rules.mjs";
import sharedRules, {
  blockerImport,
  envReadsOnlyIn,
  webEnvReads,
} from "../../eslint/shared-rules.mjs";

const SHARED_IMPORT_PATTERNS = ["../../../shared/*"];

export default defineConfig([
  {
    ignores: [".react-router/", "build/", "public/"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReactHooks.configs["recommended-latest"],
  sharedRules,
  envReadsOnlyIn({
    files: ["**/*.{ts,tsx}"],
    ignores: ["vite.config.ts", "**/*.test.{ts,tsx}", "**/*.testing.{ts,tsx}"],
    ...webEnvReads,
  }),
  apiClientRules,
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: SHARED_IMPORT_PATTERNS,
          paths: [blockerImport("apps/admin/src/components/LeaveGuard.tsx")],
        },
      ],
    },
  },
  {
    files: ["src/components/LeaveGuard.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: SHARED_IMPORT_PATTERNS }],
    },
  },
]);
