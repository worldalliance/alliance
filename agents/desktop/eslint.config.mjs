import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import sharedRules from "../../eslint/shared-rules.mjs";

export default defineConfig([
  { ignores: ["out/"] },
  tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
  sharedRules,
]);
