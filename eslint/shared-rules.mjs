const moduleMockMessage =
  "bun writes a module mock into a registry every later test file in the process reads, and restores it for none of them. Reach for jest.spyOn(module, export) with jest.restoreAllMocks(), or serveApi() from @alliance/shared/lib/testing/serveApi to answer the generated client.";

export default {
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
};
