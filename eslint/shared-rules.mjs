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

const configModule = {
  rules: { "env-reads": builtinRules.get("no-restricted-syntax") },
};

/** Lets only an app's config module read the env vars `selector` matches. */
export function envReadsOnlyIn({ files, ignores = [], selector, reader }) {
  return {
    files,
    ignores,
    plugins: { "config-module": configModule },
    rules: {
      "config-module/env-reads": [
        "error",
        { selector, message: `Read env vars through ${reader}.` },
      ],
    },
  };
}

export const serverEnvReads = {
  selector: [
    "MemberExpression[property.name='env']:matches([object.name=/^(process|Bun)$/], [object.property.name='process'], [object.type='MetaProperty'])",
    "MemberExpression[computed=true][property.value='env'][object.name=/^(process|Bun)$/]",
    "ImportDeclaration[source.value=/^(node:)?process$/] > ImportSpecifier[imported.name='env']",
    "VariableDeclarator[init.name=/^(process|Bun)$/] > ObjectPattern > Property[key.name='env']",
  ].join(", "),
  reader: "env() or requireEnv() in src/config/env.ts",
};

// `process.env`, `process["env"]` and `globalThis.process.env`.
const processEnv =
  "MemberExpression:matches([property.name='env'], [property.value='env']):matches([object.name='process'], [object.property.name='process'])";
const importMetaEnv =
  "MemberExpression[object.type='MetaProperty'][property.name='env']";
const exceptDotted = (names) =>
  `:not(MemberExpression[computed=false][property.name=/^(${names})$/] > .object)`;

// A bundler inlines only a dotted read of a name it knows, so a computed key,
// destructuring, or the whole object reads nothing in a built app. Vite's own
// values and Storybook's flag aren't env vars; NODE_ENV, and Metro's EXPO_OS,
// are the process.env names the bundlers inline.
export const webEnvReads = {
  selector: [
    importMetaEnv + exceptDotted("MODE|DEV|PROD|SSR|BASE_URL|STORYBOOK"),
    processEnv + exceptDotted("NODE_ENV"),
  ].join(", "),
  reader: "webEnv() in sharedweb/lib/env.ts",
};

export const mobileEnvReads = {
  selector: processEnv + exceptDotted("NODE_ENV|EXPO_OS"),
  reader: "mobileEnv() in lib/env.ts",
};

export const sharedEnvReads = {
  selector: [importMetaEnv, processEnv + exceptDotted("NODE_ENV")].join(", "),
  reader: "the app's webEnv() or mobileEnv(), and pass the value in",
};

export default [
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    plugins: {
      zod: {
        rules: { "named-import": builtinRules.get("no-restricted-syntax") },
      },
    },
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "jest", property: "mock", message: moduleMockMessage },
        { object: "mock", property: "module", message: moduleMockMessage },
      ],
      "zod/named-import": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value=/^zod(\\/|$)/] > :matches(ImportDefaultSpecifier, ImportSpecifier[imported.name='default'])",
          message:
            'Import `{ z }` from "zod". The default export defeats tree-shaking and ships every zod locale to the browser.',
        },
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
