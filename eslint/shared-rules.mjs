import { builtinRules } from "eslint/use-at-your-own-risk";

const coreMaxLines = builtinRules.get("max-lines");
const maxLines = {
  ...coreMaxLines,
  meta: {
    ...coreMaxLines.meta,
    messages: {
      exceed:
        "File has too many lines ({{actual}}). Maximum allowed is {{max}}. A file past the limit is already overdue for a split: split it before adding to it.",
    },
  },
};

const moduleMockMessage =
  "bun writes a module mock into a registry every later test file in the process reads, and restores it for none of them. Reach for jest.spyOn(module, export) with jest.restoreAllMocks(), or serveApi() from @alliance/shared/lib/testing/serveApi to answer the generated client.";

export default [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "jest", property: "mock", message: moduleMockMessage },
        { object: "mock", property: "module", message: moduleMockMessage },
      ],
      "prefer-const": "warn",
      "no-constant-binary-expression": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    ignores: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/*-spec.*",
      "**/test/**",
      "**/migrations/**",
      "**/*.gen.ts",
      "**/*.typecheck.ts",
    ],
    plugins: { alliance: { rules: { "max-lines": maxLines } } },
    rules: {
      "alliance/max-lines": ["warn", { max: 500, skipBlankLines: true }],
    },
  },
];
