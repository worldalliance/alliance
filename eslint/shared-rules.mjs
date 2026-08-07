export default {
  files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
  rules: {
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
