import { builtinRules } from "eslint/use-at-your-own-risk";

const sdkMessage =
  "Call the API through its generated function in @alliance/shared/client (sdk.gen.ts), which types the request and response and applies the app's client config. Regenerate the client if the endpoint is missing.";

const fetchMessage = `${sdkMessage} For a third-party URL, disable this rule on the line.`;

const namedHookMessage =
  "Call the generated client from a named hook in a use* file that owns its query cache, so every read and write of that cache goes through one place. For a call that touches no cache, such as auth or an upload, disable this rule on the import and say why.";

export default [
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/*.test.*", "**/*.gen.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: fetchMessage,
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='client'][callee.property.name=/^(connect|delete|get|head|options|patch|post|put|request|trace)$/]",
          message: sdkMessage,
        },
        {
          selector:
            "MemberExpression[object.name=/^(window|globalThis|self)$/][property.name='fetch']",
          message: fetchMessage,
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "**/*.test.*",
      "**/*.gen.ts",
      "**/use[A-Z]*.ts",
      "**/use[A-Z]*.tsx",
    ],
    plugins: {
      "api-client": {
        rules: { "named-hooks-only": builtinRules.get("no-restricted-syntax") },
      },
    },
    rules: {
      "api-client/named-hooks-only": [
        "error",
        {
          selector:
            "ImportDeclaration[importKind!='type'][source.value=/^(@alliance\\/shared\\/|(\\.\\.?\\/)+(shared\\/)?)client(\\/(index|sdk\\.gen))?$/]:has(ImportSpecifier[importKind!='type'][imported.name=/^[a-z]/], ImportNamespaceSpecifier)",
          message: namedHookMessage,
        },
      ],
    },
  },
];
