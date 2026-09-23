import { describe, expect, test } from "bun:test";

function jq(params: {
  filter: string;
  input: unknown;
  env?: Record<string, string>;
}): unknown[] {
  const result = Bun.spawnSync(
    ["jq", "-c", "-f", `${import.meta.dir}/../${params.filter}`],
    {
      stdin: Buffer.from(JSON.stringify(params.input)),
      env: { ...process.env, ...params.env },
    },
  );
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe("superseded.jq", () => {
  const pr = (number: number, headRefName: string) => ({
    number,
    headRefName,
    author: { login: "app/github-actions" },
  });

  test("picks the author's other pull requests on the prefix", () => {
    expect(
      jq({
        filter: "actions/open-superseding-pr/superseded.jq",
        input: [
          pr(1, "tzdb/2026c"),
          pr(3, "tzdb/2026d"),
          pr(4, "auto-fix/abc"),
          {
            number: 5,
            headRefName: "tzdb/by-hand",
            author: { login: "someone" },
          },
        ],
        env: {
          AUTHOR: "app/github-actions",
          PREFIX: "tzdb/",
          BRANCH: "tzdb/2026d",
        },
      }),
    ).toEqual([1]);
  });
});
