import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import apiClientRules from "../../eslint/api-client-rules.mjs";
import sharedRules from "../../eslint/shared-rules.mjs";

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
  apiClientRules,
  {
    rules: {
      "react/react-in-jsx-scope": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: ["../../../shared/*"],
        },
      ],
    },
  },
]);
