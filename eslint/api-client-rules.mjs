const sdkMessage =
  "Call the API through its generated function in @alliance/shared/client (sdk.gen.ts), which types the request and response and applies the app's client config. Regenerate the client if the endpoint is missing.";

const fetchMessage = `${sdkMessage} For a third-party URL, disable this rule on the line.`;

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
];
