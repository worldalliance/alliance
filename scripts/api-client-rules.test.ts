import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import apiClientRules from "../eslint/api-client-rules.mjs";

const RULE = "api-client/named-hooks-only";

const flagged = (code: string, filename = "src/pages/Page.tsx") =>
  new Linter({ configType: "flat" })
    .verify(
      code,
      [
        {
          files: ["**/*.ts", "**/*.tsx"],
          languageOptions: { parser: tseslint.parser },
        },
        ...apiClientRules,
      ],
      filename,
    )
    .some((message) => message.ruleId === RULE);

describe(RULE, () => {
  it.each([
    'import { authMe } from "@alliance/shared/client";',
    'import { authMe } from "@alliance/shared/client/sdk.gen";',
    'import { authMe } from "@alliance/shared/client/index";',
    'import { authMe, UserDto } from "@alliance/shared/client";',
    'import * as sdk from "@alliance/shared/client";',
    'import { authMe } from "../client";',
    'import { authMe } from "../../../shared/client";',
  ])("flags %s outside a use* file", (code) => {
    expect(flagged(code)).toBe(true);
  });

  it.each([
    'import type { UserDto } from "@alliance/shared/client";',
    'import { type UserDto } from "@alliance/shared/client";',
    'import { UserDto } from "@alliance/shared/client";',
    'import { authMe } from "@alliance/shared/client/types.gen";',
    'import { useQuery } from "@tanstack/react-query";',
  ])("allows %s", (code) => {
    expect(flagged(code)).toBe(false);
  });

  it("flags a file whose name only starts with use", () => {
    expect(
      flagged(
        'import { authMe } from "@alliance/shared/client";',
        "shared/lib/user.ts",
      ),
    ).toBe(true);
  });

  it.each(["shared/lib/useMe.ts", "src/lib/useMe.tsx", "src/Page.test.tsx"])(
    "exempts %s",
    (filename) => {
      expect(
        flagged('import { authMe } from "@alliance/shared/client";', filename),
      ).toBe(false);
    },
  );
});
