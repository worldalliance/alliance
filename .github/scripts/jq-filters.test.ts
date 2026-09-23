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

const HASH = "0123456789ab";

describe("formatjs-declined.jq", () => {
  const declined = (prs: unknown[]) =>
    jq({ filter: "scripts/formatjs-declined.jq", input: prs });

  test("picks closed and merged pull requests", () => {
    expect(
      declined([
        { number: 1, state: "CLOSED", labels: [] },
        { number: 2, state: "MERGED", labels: [] },
        { number: 3, state: "CLOSED", labels: [{ name: "dependencies" }] },
      ]),
    ).toEqual([1, 2, 3]);
  });

  test("ignores open ones and ones closed as superseded", () => {
    expect(
      declined([
        { number: 1, state: "OPEN", labels: [] },
        { number: 2, state: "CLOSED", labels: [{ name: "superseded" }] },
      ]),
    ).toEqual([]);
  });

  test("ignores a fork's pull requests", () => {
    expect(
      declined([
        { number: 1, state: "CLOSED", labels: [], isCrossRepository: true },
        { number: 2, state: "MERGED", labels: [], isCrossRepository: true },
      ]),
    ).toEqual([]);
  });
});

describe("tzdb-pr-declined.jq", () => {
  const declined = (pr: { state: string; body: string; headlines: string[] }) =>
    jq({
      filter: "scripts/tzdb-pr-declined.jq",
      input: {
        state: pr.state,
        body: pr.body,
        commits: pr.headlines.map((messageHeadline) => ({ messageHeadline })),
      },
      env: { AFTER: HASH, HEADLINE: `add-all-tz.js SHA-1 ${HASH}` },
    });
  const pushed = `add-all-tz.js SHA-1 ${HASH}: bump @formatjs/intl-datetimeformat to 7.9.0`;

  test("counts a revert of the pushed bump on an open pull request", () => {
    expect(
      declined({
        state: "OPEN",
        body: "",
        headlines: [pushed, `Revert "${pushed}"`],
      }),
    ).toEqual([1]);
  });

  test("counts a revert whose headline GitHub cut off", () => {
    const cut = (headline: string) => `${headline.slice(0, 69)}…`;
    expect(
      declined({
        state: "OPEN",
        body: "",
        headlines: [cut(pushed), cut(`Revert "${pushed}"`)],
      }),
    ).toEqual([1]);
    expect(
      declined({
        state: "OPEN",
        body: "",
        headlines: [cut(pushed), cut(`Revert "Reapply "${pushed}""`)],
      }),
    ).toEqual([1]);
  });

  test("takes the decline back when git reapplies the bump, and counts a revert of that", () => {
    const reverted = `Revert "${pushed}"`;
    const reapplied = `Reapply "${pushed}"`;
    expect(
      declined({
        state: "CLOSED",
        body: "",
        headlines: [pushed, reverted, reapplied],
      }),
    ).toEqual([0]);
    expect(
      declined({
        state: "CLOSED",
        body: "",
        headlines: [pushed, reverted, reapplied, `Revert "${reapplied}"`],
      }),
    ).toEqual([1]);
  });

  test("takes the decline back when an older git reverts the revert", () => {
    const reverted = `Revert "${pushed}"`;
    expect(
      declined({
        state: "CLOSED",
        body: "",
        headlines: [pushed, reverted, `Revert "${reverted}"`],
      }),
    ).toEqual([0]);
  });

  test("counts a second revert of the pushed bump after git reapplies it", () => {
    expect(
      declined({
        state: "CLOSED",
        body: "",
        headlines: [
          pushed,
          `Revert "${pushed}"`,
          `Reapply "${pushed}"`,
          `Revert "${pushed}"`,
        ],
      }),
    ).toEqual([1]);
  });

  test("ignores a revert of other tz data", () => {
    expect(
      declined({
        state: "OPEN",
        body: "",
        headlines: [`Revert "add-all-tz.js SHA-1 ba9876543210: bump"`],
      }),
    ).toEqual([0]);
  });

  test("counts a merged pull request that named the tz data in its body or a headline", () => {
    expect(
      declined({ state: "MERGED", body: `SHA-1 ${HASH}`, headlines: [] }),
    ).toEqual([1]);
    expect(
      declined({ state: "MERGED", body: "", headlines: [pushed] }),
    ).toEqual([1]);
  });

  test("ignores a merged pull request that named other tz data", () => {
    const other = "ba9876543210";
    expect(
      declined({
        state: "MERGED",
        body: `SHA-1 ${other}`,
        headlines: [
          `add-all-tz.js SHA-1 ${other}: bump @formatjs/intl-datetimeformat to 7.8.0`,
        ],
      }),
    ).toEqual([0]);
  });

  test("ignores an open or closed pull request that named the tz data without reverting it", () => {
    expect(
      declined({ state: "OPEN", body: `SHA-1 ${HASH}`, headlines: [pushed] }),
    ).toEqual([0]);
    expect(
      declined({ state: "CLOSED", body: `SHA-1 ${HASH}`, headlines: [pushed] }),
    ).toEqual([0]);
  });
});

describe("superseded.jq", () => {
  const pr = (number: number, headRefName: string) => ({
    number,
    headRefName,
    author: { login: "app/github-actions" },
  });

  test("picks the author's other pull requests on any of the prefixes", () => {
    expect(
      jq({
        filter: "actions/open-superseding-pr/superseded.jq",
        input: [
          pr(1, "tzdb/2026c"),
          pr(2, "formatjs/ba9876543210"),
          pr(3, "tzdb/2026d"),
          pr(4, "auto-fix/abc"),
          {
            number: 5,
            headRefName: "formatjs/upgrade-v8",
            author: { login: "someone" },
          },
        ],
        env: {
          AUTHOR: "app/github-actions",
          PREFIXES: "tzdb/ formatjs/",
          BRANCH: "tzdb/2026d",
        },
      }),
    ).toEqual([1, 2]);
  });
});
