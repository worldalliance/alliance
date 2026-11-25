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
import designRules from "./eslint/design-rules.mjs";
import { readLegacyFiles } from "./eslint/legacy.mjs";

const SHARED_IMPORT_PATTERNS = ["../../../shared/*"];

// The builtin rules under the admin's own names, so these options don't
// replace the ones the shared configs give the same rules.
const design = {
  rules: {
    ...designRules.rules,
    imports: builtinRules.get("no-restricted-imports"),
    "no-global-confirm": builtinRules.get("no-restricted-globals"),
    "no-window-confirm": builtinRules.get("no-restricted-properties"),
  },
};

const USE_CONFIRM =
  "Ask through `useConfirmOnPage` (lib/useConfirmOnPage.ts), which opens the admin's confirm dialog. See Confirmations in apps/admin/DESIGN.md.";

const designImports = ({ sharedUi }) => [
  "error",
  {
    paths: [
      {
        name: "@alliance/shared/styles/util",
        importNames: ["cn"],
        message:
          "Use `cn` from apps/admin/src/ui/cn.ts: the shared one doesn't know the admin's tokens and drops `text-body` beside `text-fg`.",
      },
    ],
    patterns: [
      ...(sharedUi
        ? []
        : [
            {
              group: ["@alliance/sharedweb/ui/*"],
              message:
                "Admin components come from apps/admin/src/ui. If it lacks one, ask for it as apps/admin/DESIGN.md says.",
            },
          ]),
      {
        group: ["**/ui/Button"],
        importNames: ["ButtonColor"],
        message:
          "Pass `variant={ButtonVariant.X}`; `color` is the pre-redesign prop.",
      },
    ],
  },
];

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
      // The rule's default also forbids a straight apostrophe, which is how
      // the admin's copy writes "Couldn't".
      "react/no-unescaped-entities": ["error", { forbid: [">", "}", '"'] }],
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
    files: ["src/**/*.{ts,tsx}"],
    ignores: readLegacyFiles(),
    plugins: { admin: design },
    rules: {
      "admin/design-tokens": "error",
      "admin/design-values": "error",
      "admin/imports": designImports({ sharedUi: false }),
      "admin/no-global-confirm": [
        "error",
        { name: "confirm", message: USE_CONFIRM },
      ],
      "admin/no-window-confirm": [
        "error",
        { object: "window", property: "confirm", message: USE_CONFIRM },
        { object: "globalThis", property: "confirm", message: USE_CONFIRM },
      ],
    },
  },
  {
    // The admin's components wrap or re-export the shared ones on purpose.
    files: ["src/ui/**/*.{ts,tsx}"],
    plugins: { admin: design },
    rules: { "admin/imports": designImports({ sharedUi: true }) },
  },
  {
    files: ["src/components/LeaveGuard.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: SHARED_IMPORT_PATTERNS }],
    },
  },
]);
