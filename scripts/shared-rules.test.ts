import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import apiClientRules from "../eslint/api-client-rules.mjs";
import sharedRules from "../eslint/shared-rules.mjs";

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
