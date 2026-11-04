import { ConfigCommentParser } from "@eslint/plugin-kit";
import { builtinRules } from "eslint/use-at-your-own-risk";

const WAIVER = /^\*?\s*alliance\/max-lines\s+\d/;
const WAIVER_FORM = /^\s*alliance\/max-lines (\d+) -- \S/;
const STEP = 50;
const nonBlankLines = (text) =>
  text.split(/\r\n|[\r\n\u2028\u2029]/u).filter((line) => line.trim()).length;
const ceilingFor = (lines) => Math.ceil(lines / STEP) * STEP;
const waiverExample = (lines) =>
  `/* alliance/max-lines ${ceilingFor(lines)} -- <why it is one unit> */`;

const maxLines = {
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { max: { type: "integer", minimum: 0 } },
        required: ["max"],
        additionalProperties: false,
      },
    ],
    messages: {
      exceed:
        "File has {{actual}} non-blank lines (max {{max}}). Before adding to it, follow the root AGENTS.md File size rule: split it, or keep it whole with {{waiver}} at its top.",
      pastWaiver:
        "File has {{actual}} non-blank lines, past the {{recorded}} its waiver records. Follow the root AGENTS.md File size rule again: split it, or raise the waiver to {{ceiling}} and revise its reason.",
      malformed:
        "Write the waiver as {{waiver}}: a multiple of {{step}} above {{max}} and a reason.",
      unneeded:
        "Without its waiver the file has {{actual}} non-blank lines, within the {{max}} limit. Remove the waiver.",
      belowWaiver:
        "File has {{actual}} non-blank lines, so its waiver needs only {{ceiling}}, below the {{recorded}} it records. Lower the waiver to {{ceiling}}.",
      duplicate:
        "Only the first alliance/max-lines waiver counts. Remove this one.",
    },
  },
  create(context) {
    const { max } = context.options[0];
    return {
      "Program:exit"() {
        const { sourceCode } = context;
        const { text } = sourceCode;
        const actual = nonBlankLines(text);
        const [waiver, ...extras] = sourceCode
          .getAllComments()
          .filter((comment) => WAIVER.test(comment.value));
        for (const extra of extras) {
          context.report({ node: extra, messageId: "duplicate" });
        }
        if (!waiver) {
          if (actual > max) {
            context.report({
              loc: { line: 1, column: 0 },
              messageId: "exceed",
              data: { actual, max, waiver: waiverExample(actual + 1) },
            });
          }
          return;
        }
        const recorded =
          waiver.type === "Block"
            ? Number(WAIVER_FORM.exec(waiver.value)?.[1])
            : NaN;
        const ceiling = ceilingFor(actual);
        const [start, end] = waiver.range;
        const withoutWaiver = nonBlankLines(
          text.slice(0, start) + text.slice(end),
        );
        if (withoutWaiver <= max) {
          context.report({
            node: waiver,
            messageId: "unneeded",
            data: { actual: withoutWaiver, max },
          });
        } else if (!(recorded > max && recorded % STEP === 0)) {
          context.report({
            node: waiver,
            messageId: "malformed",
            data: { max, step: STEP, waiver: waiverExample(actual) },
          });
        } else if (actual > recorded) {
          context.report({
            node: waiver,
            messageId: "pastWaiver",
            data: { actual, recorded, ceiling },
          });
        } else if (ceiling < recorded) {
          context.report({
            node: waiver,
            messageId: "belowWaiver",
            data: { actual, recorded, ceiling },
          });
        }
      },
    };
  },
};

const noMaxLinesDisable = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      disable:
        "Don't name alliance/max-lines in an eslint directive: disabling or reconfiguring it drops its ceiling. Follow the root AGENTS.md File size rule: split the file, or keep it whole with /* alliance/max-lines <ceiling> -- <why it is one unit> */ at its top.",
    },
  },
  create(context) {
    const parser = new ConfigCommentParser();
    const names = (rules) => Object.hasOwn(rules, "alliance/max-lines");
    return {
      Program() {
        const { sourceCode } = context;
        for (const { node, value } of sourceCode.getDisableDirectives()
          .directives) {
          if (names(parser.parseListConfig(value))) {
            context.report({ node, messageId: "disable" });
          }
        }
        for (const node of sourceCode.getInlineConfigNodes()) {
          const { label, value } = parser.parseDirective(node.value);
          const parsed =
            label === "eslint" && parser.parseJSONLikeConfig(value);
          if (parsed && parsed.ok && names(parsed.config)) {
            context.report({ node, messageId: "disable" });
          }
        }
      },
    };
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
    plugins: {
      alliance: {
        rules: {
          "max-lines": maxLines,
          "no-max-lines-disable": noMaxLinesDisable,
        },
      },
    },
    rules: {
      "alliance/max-lines": ["warn", { max: 500 }],
      "alliance/no-max-lines-disable": "error",
    },
  },
];
