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

  test("picks closed pull requests, merged ones included", () => {
    expect(
      declined([
        { number: 1, state: "closed", labels: [] },
        { number: 2, state: "closed", labels: [{ name: "dependencies" }] },
      ]),
    ).toEqual([1, 2]);
  });

  test("ignores open ones and ones closed as superseded", () => {
    expect(
      declined([
        { number: 1, state: "open", labels: [] },
        { number: 2, state: "closed", labels: [{ name: "superseded" }] },
      ]),
    ).toEqual([]);
  });
});

describe("tzdb-pr-declined.jq", () => {
  const declined = (pr: {
    state: string;
    body: string;
    headlines: string[];
    comments?: { login: string; body: string }[];
  }) =>
    jq({
      filter: "scripts/tzdb-pr-declined.jq",
      input: {
        state: pr.state,
        body: pr.body,
        commits: pr.headlines.map((messageHeadline) => ({ messageHeadline })),
        comments: (pr.comments ?? []).map(({ login, body }) => ({
          author: { login },
          body,
        })),
      },
      env: { AFTER: HASH, HEADLINE: `add-all-tz.js SHA-1 ${HASH}` },
    });
  const pushed = `add-all-tz.js SHA-1 ${HASH}: bump @formatjs/intl-datetimeformat to 7.9.0`;
  const proposed = `Its own commit bumps it to 7.9.0, which changes its tz data (\`add-all-tz.js\` SHA-1 ${HASH}).`;

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
      declined({ state: "MERGED", body: proposed, headlines: [] }),
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

  test("counts tz data the watch's comment named after a force-push dropped its commit", () => {
    const dropped = (state: string) =>
      declined({
        state,
        body: "",
        headlines: ["bump tzdb to 2026d"],
        comments: [{ login: "github-actions", body: `SHA-1 ${HASH}` }],
      });
    expect(dropped("OPEN")).toEqual([1]);
    expect(dropped("CLOSED")).toEqual([1]);
    expect(dropped("MERGED")).toEqual([1]);
  });

  test("counts tz data the body named after a force-push dropped its commit", () => {
    const dropped = (state: string) =>
      declined({
        state,
        body: proposed,
        headlines: ["bump tzdb to 2026d"],
      });
    expect(dropped("OPEN")).toEqual([1]);
    expect(dropped("CLOSED")).toEqual([1]);
  });

  test("ignores tz data the body proposed while its commit stays", () => {
    const kept = (state: string) =>
      declined({
        state,
        body: proposed,
        headlines: [pushed, "bump tzdb to 2026d"],
      });
    expect(kept("OPEN")).toEqual([0]);
    expect(kept("CLOSED")).toEqual([0]);
  });

  test("matches the sentence tzdb-release-watch.yaml's body proposes a bump with", async () => {
    const filter = await Bun.file(
      `${import.meta.dir}/tzdb-pr-declined.jq`,
    ).text();
    const sentence = filter.match(/contains\("(Its own commit[^"]*)"\)/)?.[1];
    expect(sentence).toBeDefined();
    const workflow = await Bun.file(
      `${import.meta.dir}/../workflows/tzdb-release-watch.yaml`,
    ).text();
    expect(workflow).toContain(sentence ?? "");
  });

  test("ignores a body saying another pull request declined the tz data", () => {
    expect(
      declined({
        state: "CLOSED",
        body: `This leaves it alone: the latest release changes its tz data (\`add-all-tz.js\` SHA-1 ${HASH}), but #12 declined that tz data.`,
        headlines: ["bump tzdb to 2026e"],
      }),
    ).toEqual([0]);
  });

  test("ignores tz data the watch's comment named while its commit stays", () => {
    expect(
      declined({
        state: "OPEN",
        body: "",
        headlines: ["bump tzdb to 2026d", pushed],
        comments: [{ login: "github-actions", body: `SHA-1 ${HASH}` }],
      }),
    ).toEqual([0]);
  });

  test("ignores tz data someone else's comment named", () => {
    expect(
      declined({
        state: "MERGED",
        body: "",
        headlines: ["bump tzdb to 2026d"],
        comments: [{ login: "someone", body: `please bump to ${HASH}` }],
      }),
    ).toEqual([0]);
  });
});

describe("tzdb-pr-carried.jq", () => {
  const carried = (pr: { body: string; headlines: string[] }) =>
    jq({
      filter: "scripts/tzdb-pr-carried.jq",
      input: {
        body: pr.body,
        commits: pr.headlines.map((messageHeadline) => ({ messageHeadline })),
      },
      env: { TZDATA: HASH },
    });

  test("finds the tz data in the body or a headline", () => {
    expect(carried({ body: `SHA-1 ${HASH}`, headlines: [] })).toEqual([true]);
    expect(
      carried({ body: "", headlines: [`add-all-tz.js SHA-1 ${HASH}: bump`] }),
    ).toEqual([true]);
  });

  test("misses tz data the pull request never named", () => {
    expect(
      carried({
        body: "SHA-1 ba9876543210",
        headlines: ["bump tzdb to 2026d"],
      }),
    ).toEqual([false]);
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

describe("staging-build-plan.jq", () => {
  const IOS = "a".repeat(40);
  const ANDROID = "b".repeat(40);
  const OTHER = "c".repeat(40);
  const lines = (byPlatform: Record<string, string>) =>
    Object.entries(byPlatform)
      .map(([platform, fingerprint]) => `${platform}: ${fingerprint}\n`)
      .join("");
  const running = (name: string) => ({
    name,
    status: "in_progress",
    conclusion: null,
    newer: false,
  });
  const plan = (input: {
    platforms?: string;
    force?: boolean;
    latest?: Record<string, string>;
    otherJobs?: unknown[];
    fingerprints?: Record<string, string>;
  }) =>
    jq({
      filter: "scripts/staging-build-plan.jq",
      input: {
        platforms: "both",
        force: false,
        otherJobs: [],
        ...input,
        fingerprints: lines(
          input.fingerprints ?? { ios: IOS, android: ANDROID },
        ),
        latest: lines(input.latest ?? {}),
      },
    })[0];
  const platforms = (input: Parameters<typeof plan>[0]) =>
    (plan(input) as { platform: string }[]).map((p) => p.platform);

  test("builds every platform with no submitted build", () => {
    expect(plan({})).toEqual([
      {
        platform: "ios",
        fingerprint: IOS,
        name: `Build ios ${IOS}`,
        runner: "macos-26",
        timeout: 60,
        artifact: "ipa",
      },
      {
        platform: "android",
        fingerprint: ANDROID,
        name: `Build android ${ANDROID}`,
        runner: "ubuntu-latest",
        timeout: 45,
        artifact: "aab",
      },
    ]);
  });

  test("skips a platform whose fingerprint is its latest submitted build", () => {
    expect(platforms({ latest: { ios: IOS } })).toEqual(["android"]);
    expect(platforms({ latest: { ios: ANDROID } })).toEqual(["ios", "android"]);
  });

  test("rebuilds an older fingerprint after a revert", () => {
    expect(platforms({ latest: { ios: OTHER, android: ANDROID } })).toEqual([
      "ios",
    ]);
  });

  test("force rebuilds the latest fingerprint", () => {
    expect(
      plan({
        force: true,
        platforms: "android",
        latest: { android: ANDROID },
      }),
    ).toMatchObject([{ platform: "android" }]);
  });

  test("skips a fingerprint another run is already building", () => {
    expect(
      plan({
        platforms: "ios",
        force: true,
        otherJobs: [running(`Build ios ${IOS}`)],
      }),
    ).toEqual([]);
    expect(
      plan({ platforms: "ios", otherJobs: [running(`Build ios ${OTHER}`)] }),
    ).toMatchObject([{ platform: "ios" }]);
  });

  test("skips a fingerprint another run built and has yet to tag", () => {
    expect(
      plan({
        platforms: "ios",
        otherJobs: [
          {
            name: `Build ios ${IOS}`,
            status: "completed",
            conclusion: "success",
            newer: false,
          },
        ],
      }),
    ).toEqual([]);
  });

  test("ignores another run's failed or cancelled build", () => {
    expect(
      platforms({
        latest: { ios: IOS, android: ANDROID },
        otherJobs: ["failure", "cancelled"].map((conclusion) => ({
          name: `Build ios ${OTHER}`,
          status: "completed",
          conclusion,
          newer: false,
        })),
      }),
    ).toEqual([]);
  });

  test("supersedes another fingerprint's running build of the same platform", () => {
    expect(
      platforms({
        latest: { ios: IOS, android: ANDROID },
        otherJobs: [running(`Build ios ${OTHER}`)],
      }),
    ).toEqual(["ios"]);
  });

  test("leaves a platform to a newer commit's build of another fingerprint", () => {
    expect(
      platforms({
        force: true,
        otherJobs: [{ ...running(`Build ios ${OTHER}`), newer: true }],
      }),
    ).toEqual(["android"]);
  });

  test("fails without a fingerprint for a requested platform", () => {
    expect(() => plan({ fingerprints: { ios: IOS } })).toThrow(
      "no android fingerprint",
    );
  });
});
