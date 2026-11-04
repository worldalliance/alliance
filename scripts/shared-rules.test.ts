import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import apiClientRules from "../eslint/api-client-rules.mjs";
import sharedRules, {
  envReadsOnlyIn,
  mobileEnvReads,
  serverEnvReads,
  sharedEnvReads,
  webEnvReads,
} from "../eslint/shared-rules.mjs";

const tsFile = {
  files: ["**/*.ts"],
  languageOptions: { parser: tseslint.parser },
  plugins: { "@typescript-eslint": tseslint.plugin },
};

const RULE = "zod/named-import";

const flagged = (code: string) =>
  new Linter({ configType: "flat" })
    .verify(
      `${code}\nexport const schema = z.string();`,
      [tsFile, ...sharedRules, ...apiClientRules],
      "src/schema.ts",
    )
    .some((message) => message.ruleId === RULE);

describe(RULE, () => {
  it.each([
    'import z from "zod";',
    'import type z from "zod";',
    'import { default as z } from "zod";',
    'import z from "zod/v4";',
    'import z from "zod/mini";',
  ])("flags %s", (code) => {
    expect(flagged(code)).toBe(true);
  });

  it.each([
    'import { z } from "zod";',
    'import * as z from "zod";',
    'import { z as zod } from "zod";',
    'import { z } from "zod-to-json-schema";',
  ])("allows %s", (code) => {
    expect(flagged(code)).toBe(false);
  });
});

const envReadFlagged = (params: {
  reads: { selector: string; reader: string };
  code: string;
  file?: string;
}) =>
  new Linter({ configType: "flat" })
    .verify(
      params.code,
      [
        { files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } },
        envReadsOnlyIn({
          files: ["**/*.ts"],
          ignores: ["src/env.ts"],
          ...params.reads,
        }),
      ],
      params.file ?? "src/app.ts",
    )
    .some((message) => message.ruleId === "config-module/env-reads");

describe("envReadsOnlyIn", () => {
  it.each([
    [serverEnvReads, "f(process.env.DB_HOST);", true],
    [serverEnvReads, "f(Bun.env.DB_HOST);", true],
    [serverEnvReads, "f(import.meta.env.DB_HOST);", true],
    [serverEnvReads, "const { DB_HOST } = process.env;", true],
    [serverEnvReads, 'f(process["env"].DB_HOST);', true],
    [serverEnvReads, "f(globalThis.process.env.DB_HOST);", true],
    [serverEnvReads, 'import { env } from "node:process";', true],
    [serverEnvReads, 'import { env as e } from "process";', true],
    [serverEnvReads, "const { env } = process;", true],
    [serverEnvReads, 'import { cwd } from "node:process";', false],
    [serverEnvReads, 'f(env("DB_HOST"));', false],
    [webEnvReads, "f(import.meta.env.VITE_API_URL);", true],
    [webEnvReads, "f(import.meta.env?.VITE_API_URL);", true],
    [webEnvReads, 'f(import.meta.env["VITE_API_URL"]);', true],
    [webEnvReads, "const { VITE_API_URL } = import.meta.env;", true],
    [webEnvReads, "const all = import.meta.env;", true],
    [webEnvReads, "f(import.meta.env.ALLIANCE_DEV_API_URL);", true],
    [webEnvReads, "f(import.meta.env.MODE);", false],
    [webEnvReads, "f(import.meta.env.PROD);", false],
    [webEnvReads, "f(import.meta.env.STORYBOOK);", false],
    [webEnvReads, "f(process.env.VITE_API_URL);", true],
    [webEnvReads, "f(globalThis.process.env.VITE_API_URL);", true],
    [webEnvReads, 'f(process["env"].VITE_API_URL);', true],
    [webEnvReads, "f(process.env.NODE_ENV);", false],
    [mobileEnvReads, "f(process.env.EXPO_PUBLIC_API_URL);", true],
    [mobileEnvReads, "f(process.env?.EXPO_PUBLIC_API_URL);", true],
    [mobileEnvReads, 'f(process.env["EXPO_PUBLIC_API_URL"]);', true],
    [mobileEnvReads, "const { EXPO_PUBLIC_API_URL } = process.env;", true],
    [mobileEnvReads, "const all = process.env;", true],
    [mobileEnvReads, "f(process.env.SENTRY_DSN);", true],
    [mobileEnvReads, "f(globalThis.process.env.EXPO_PUBLIC_API_URL);", true],
    [mobileEnvReads, 'f(process["env"].EXPO_PUBLIC_API_URL);', true],
    [mobileEnvReads, "f(process.env.NODE_ENV);", false],
    [mobileEnvReads, "f(process.env.EXPO_OS);", false],
    [sharedEnvReads, "f(import.meta.env.VITE_API_URL);", true],
    [sharedEnvReads, "f(process.env.EXPO_PUBLIC_API_URL);", true],
    [sharedEnvReads, 'f(process.env["EXPO_PUBLIC_API_URL"]);', true],
    [sharedEnvReads, "f(import.meta.env.MODE);", true],
    [sharedEnvReads, "f(process.env.SOME_NAME);", true],
    [sharedEnvReads, 'f(process.env["NODE_ENV"]);', true],
    [sharedEnvReads, "const all = process.env;", true],
    [sharedEnvReads, "f(globalThis.process.env.SOME_NAME);", true],
    [sharedEnvReads, "f(process.env.NODE_ENV);", false],
  ])("%#: flags %p: %p", (reads, code, flagged) => {
    expect(envReadFlagged({ reads, code })).toBe(flagged);
  });

  it("allows reads in the config module", () => {
    expect(
      envReadFlagged({
        reads: webEnvReads,
        code: "f(import.meta.env.VITE_API_URL);",
        file: "src/env.ts",
      }),
    ).toBe(false);
  });
});

const maxLinesMessages = (params: { waiver?: string; lines: number }) =>
  new Linter({ configType: "flat" })
    .verify(
      [
        ...(params.waiver ? [params.waiver] : []),
        ...Array.from({ length: params.lines }, (_, i) => `f(${i});\n`),
      ].join("\n"),
      [tsFile, ...sharedRules],
      "src/big.ts",
    )
    .filter((message) => message.ruleId === "alliance/max-lines")
    .map((message) => message.message);

describe("alliance/max-lines", () => {
  it("counts non-blank lines only", () => {
    expect(maxLinesMessages({ lines: 500 })).toEqual([]);
  });

  it("flags a file past 500 with no waiver, offering one", () => {
    expect(maxLinesMessages({ lines: 501 })).toEqual([
      expect.stringContaining(
        "/* alliance/max-lines 550 -- <why it is one unit> */",
      ),
    ]);
  });

  it.each([501, 549, 550])(
    "accepts the waiver it offers at %i lines",
    (lines) => {
      const [message] = maxLinesMessages({ lines });
      expect(message).toBeDefined();
      const waiver = message?.match(/\/\* alliance\/max-lines .*? \*\//)?.[0];
      expect(maxLinesMessages({ waiver, lines })).toEqual([]);
    },
  );

  it("flags a second waiver", () => {
    expect(
      maxLinesMessages({
        waiver:
          "/* alliance/max-lines 650 -- one state machine */\n/* alliance/max-lines 9999 -- stale */",
        lines: 618,
      }),
    ).toEqual([expect.stringContaining("Only the first")]);
  });

  it.each([
    ["/* alliance/max-lines 650 -- one state machine */", 649, []],
    ["/* alliance/max-lines 650 -- one state machine */", 600, []],
    [
      "/* alliance/max-lines 650 -- one state machine */",
      598,
      ["Lower the waiver to 600"],
    ],
    [
      "/* alliance/max-lines 650 -- one state machine */",
      650,
      ["past the 650 its waiver records", "raise the waiver to 700"],
    ],
    ["/* alliance/max-lines 650 */", 600, ["Write the waiver as"]],
    [
      "/** alliance/max-lines 650 -- one state machine */",
      600,
      ["Write the waiver as /* alliance/max-lines 650"],
    ],
    [
      "/* alliance/max-lines 620 -- one state machine */",
      600,
      ["/* alliance/max-lines 650 -- <why it is one unit> */"],
    ],
    ["/* alliance/max-lines 500 -- small */", 600, ["Write the waiver as"]],
    ["// alliance/max-lines 400 -- small", 600, ["Write the waiver as"]],
    [
      "// alliance/max-lines 650 -- one state machine",
      600,
      ["Write the waiver as /* alliance/max-lines 650"],
    ],
    ["/* alliance/max-lines 300 -- small */", 299, ["Remove the waiver"]],
    [
      "/* alliance/max-lines 550 -- one state machine */",
      500,
      ["the file has 500 non-blank lines", "Remove the waiver"],
    ],
    ["// alliance/max-lines counts non-blank lines", 100, []],
    ["// alliance/max-lines-legacy 400 -- note", 100, []],
    [
      "/* alliance/max-lines 650 -- one state machine */",
      499,
      ["Remove the waiver"],
    ],
  ])("%#: %s at %i more lines", (waiver, lines, expected) => {
    const messages = maxLinesMessages({ waiver, lines });
    expect(messages).toHaveLength(expected.length ? 1 : 0);
    for (const text of expected) expect(messages[0]).toContain(text);
  });
});

describe("alliance/no-max-lines-disable", () => {
  const disableReports = (code: string) =>
    new Linter({ configType: "flat" })
      .verify(`${code}\nf();\n`, [tsFile, ...sharedRules], "src/big.ts")
      .filter((message) => message.ruleId === "alliance/no-max-lines-disable");

  it.each([
    "/* eslint-disable alliance/max-lines -- one unit */",
    "/* eslint-disable no-console, alliance/max-lines */",
    '/* eslint-disable "alliance/max-lines" */',
    "/* eslint-disable 'alliance/max-lines' -- one unit */",
    "// eslint-disable-next-line alliance/max-lines",
    "f(); // eslint-disable-line alliance/max-lines",
    "/* eslint-enable alliance/max-lines */",
    '/* eslint alliance/max-lines: ["error", { max: 9999 }] */',
  ])("flags %s", (code) => {
    expect(disableReports(code)).toHaveLength(1);
  });

  it.each([
    "/* eslint-disable no-console -- see alliance/max-lines */",
    "/* eslint-disable alliance/max-lines-legacy */",
    "// eslint-disable alliance/max-lines",
    "/* alliance/max-lines 650 -- one state machine */",
  ])("allows %s", (code) => {
    expect(disableReports(code)).toEqual([]);
  });
});
