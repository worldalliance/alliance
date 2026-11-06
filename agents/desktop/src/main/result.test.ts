import { expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(import.meta.dirname, file), "utf8");

test("the Result copy matches common's apart from its doc example's import", () => {
  expect(read("result.ts")).toBe(
    read("../../../../common/src/result.ts").replace(
      'from "@alliance/common/result"',
      'from "./result"',
    ),
  );
});
