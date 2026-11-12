import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import apiClientRules from "../../eslint/api-client-rules.mjs";
import sharedRules, {
  envReadsOnlyIn,
  frontendBlockerImport,
  webEnvReads,
} from "../../eslint/shared-rules.mjs";

const restrictedImportPatterns = ["../../../shared/*"];

export default defineConfig([
  {
    ignores: ["build/", "output/", ".react-router/", "public/"],
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
      "react/prop-types": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: restrictedImportPatterns,
          paths: [frontendBlockerImport],
        },
      ],
    },
  },
  {
    files: ["src/lib/useFullLoadOnNewBuild.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: restrictedImportPatterns },
      ],
    },
  },
]);
