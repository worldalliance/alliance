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

const RULE = "zod/named-import";

const flagged = (code: string) =>
  new Linter({ configType: "flat" })
    .verify(
      `${code}\nexport const schema = z.string();`,
      [
        {
          files: ["**/*.ts"],
          languageOptions: { parser: tseslint.parser },
          plugins: { "@typescript-eslint": tseslint.plugin },
        },
        ...sharedRules,
        ...apiClientRules,
      ],
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
