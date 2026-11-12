import eslintNestJs from "@darraghor/eslint-plugin-nestjs-typed";
import parser from "@typescript-eslint/parser";
import { builtinRules } from "eslint/use-at-your-own-risk";
import tseslint from "typescript-eslint";
import sharedRules, {
  envReadsOnlyIn,
  serverEnvReads,
} from "../eslint/shared-rules.mjs";
import localRules from "./eslint/eslint-local-rules.mjs";

export default tseslint.config([
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslintNestJs.configs.flatRecommended,
  sharedRules,
  envReadsOnlyIn({
    files: ["src/**/*.ts"],
    ignores: ["src/config/env.ts", "src/**/*.spec.ts", "src/**/*.fixtures.ts"],
    ...serverEnvReads,
  }),
  {
    plugins: { "local-rules": localRules },
    files: ["**/*.ts"],
    rules: {
      "@darraghor/nestjs-typed/controllers-should-supply-api-tags": "off",
      "local-rules/relation-optionality": "error",
      "local-rules/column-optionality": "error",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: ["@nestjs/mapped-types"],
        },
      ],
    },
  },
  {
    files: ["test/**/*.ts", "src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        { checkThenables: true },
      ],
      "local-rules/no-returned-thenable": "error",
    },
  },
  {
    files: ["test/**/*.ts"],
    plugins: {
      "test-app": {
        rules: { close: builtinRules.get("no-restricted-syntax") },
      },
    },
    rules: {
      "test-app/close": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='close']:matches([callee.object.name='app'], [callee.object.property.name='app'])",
          message:
            "Close the app with closeTestApp(app) from e2e-test-utils: app.close() alone can hang under Bun while a request is in flight.",
        },
      ],
    },
  },
]);
