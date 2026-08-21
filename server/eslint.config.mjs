import eslintNestJs from "@darraghor/eslint-plugin-nestjs-typed";
import parser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import sharedRules from "../eslint/shared-rules.mjs";
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
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
]);
