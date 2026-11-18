import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import { builtinRules } from "eslint/use-at-your-own-risk";
import globals from "globals";
import tseslint from "typescript-eslint";
import apiClientRules from "../../eslint/api-client-rules.mjs";
import sharedRules, {
  blockerImport,
  envReadsOnlyIn,
  webEnvReads,
} from "../../eslint/shared-rules.mjs";

const SHARED_IMPORT_PATTERNS = ["../../../shared/*"];

const RETIRED_CLASSES =
  "-(gray|slate|neutral|stone|yellow)-(50|[1-9]00|950|[1-4])\\b|\\boutline-none\\b|text-\\[[0-9.]+pt\\]|text-\\[([0-9]|1[0-5])(\\.[0-9]+)?px\\]|(^|[\\s:])rounded(?=\\s|$)|-\\[#(?:(?<hex1>[0-9a-fA-F])\\k<hex1>\\k<hex1>|(?<hex2>[0-9a-fA-F]{2})\\k<hex2>\\k<hex2>)\\]";
const RETIRED_CLASSES_MESSAGE =
  'Retired class: use zinc for neutrals, amber for warnings, rounded-md for the default radius, outline-hidden, and a named text size. Prose that only contains the word "rounded" needs an eslint-disable comment.';

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
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "admin-classes": {
        rules: { retired: builtinRules.get("no-restricted-syntax") },
      },
    },
    rules: {
      "admin-classes/retired": [
        "error",
        {
          selector: `Literal[value=/${RETIRED_CLASSES}/]`,
          message: RETIRED_CLASSES_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${RETIRED_CLASSES}/]`,
          message: RETIRED_CLASSES_MESSAGE,
        },
      ],
    },
  },
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
