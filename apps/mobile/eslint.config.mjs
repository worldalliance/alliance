// https://docs.expo.dev/guides/using-eslint/
import expoConfig from "eslint-config-expo/flat.js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import apiClientRules from "../../eslint/api-client-rules.mjs";
import sharedRules, {
  envReadsOnlyIn,
  mobileEnvReads,
} from "../../eslint/shared-rules.mjs";

export default defineConfig([
  expoConfig,
  {
    files: ["**/*.{ts,tsx}", "**/*.d.ts"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    ignores: ["dist/*", ".expo/"],
  },
  sharedRules,
  envReadsOnlyIn({
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/env.ts", "**/*.test.{ts,tsx}"],
    ...mobileEnvReads,
  }),
  apiClientRules,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native-keyboard-controller",
              importNames: ["KeyboardAwareScrollView"],
              message: "Use components/KeyboardAwareScrollView instead.",
            },
            {
              name: "react-native",
              importNames: ["Text"],
              message: "Use components/system/Text instead.",
            },
          ],
        },
      ],
    },
  },
]);
