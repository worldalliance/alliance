import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const workflow = Bun.YAML.parse(
  await Bun.file(`${import.meta.dir}/../workflows/code-review.yaml`).text(),
);
const step = workflow.jobs.gate.steps.find(
  (s: { id?: string }) => s.id === "gate",
);
if (typeof step?.run !== "string") throw new Error("Missing gate step");

const pushedAt = 1_800_000_000;
const iso = (epoch: number) =>
  new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const prs = (
  nodes: {
    isDraft: boolean;
    isCrossRepository?: boolean;
    readyAt?: number;
  }[],
) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequests: {
          nodes: nodes.map((n) => ({
            isDraft: n.isDraft,
            isCrossRepository: n.isCrossRepository ?? false,
            timelineItems: {
              nodes:
                n.readyAt === undefined ? [] : [{ createdAt: iso(n.readyAt) }],
            },
          })),
        },
      },
    },
  });

const cases: {
  name: string;
  event: "push" | "pull_request";
  message?: string;
  response: string;
  expected: boolean;
}[] = [
  { name: "push, no PR", event: "push", response: prs([]), expected: true },
  {
    name: "push, draft PR",
    event: "push",
    response: prs([{ isDraft: true }]),
    expected: false,
  },
  {
    name: "push, PR never a draft",
    event: "push",
    response: prs([{ isDraft: false }]),
    expected: true,
  },
  {
    name: "push, PR marked ready before the push",
    event: "push",
    response: prs([{ isDraft: false, readyAt: pushedAt - 10 }]),
    expected: true,
  },
  {
    name: "push, PR marked ready after the push",
    event: "push",
    response: prs([{ isDraft: false, readyAt: pushedAt + 10 }]),
    expected: false,
  },
  {
    name: "push, draft PR from a fork",
    event: "push",
    response: prs([{ isDraft: true, isCrossRepository: true }]),
    expected: true,
  },
  {
    name: "push, merge head",
    event: "push",
    message: "Merge branch 'main' into feature",
    response: "gh must not be called",
    expected: false,
  },
  {
    name: "push, lowercase merge head",
    event: "push",
    message: "merge branch 'main' into feature",
    response: "gh must not be called",
    expected: false,
  },
  {
    name: "ready, normal head",
    event: "pull_request",
    response: JSON.stringify({ commit: { message: "Add a feature" } }),
    expected: true,
  },
  {
    name: "ready, merge head",
    event: "pull_request",
    response: JSON.stringify({
      commit: { message: "Merge branch 'main' into feature" },
    }),
    expected: false,
  },
];

const expectedGhArgs = (c: (typeof cases)[number]) => {
  if (c.event === "pull_request")
    return [
      "api",
      "repos/owner/repo/commits/abc123",
      "--jq",
      ".commit.message",
    ];
  if (/merge branch/i.test(c.message ?? "")) return null;
  return [
    "api",
    "graphql",
    "-f",
    "owner=owner",
    "-f",
    "name=repo",
    "-f",
    "head=feature",
    "-f",
    `query=${step.env.PRS_QUERY}`,
    "--jq",
    step.env.HELD_FILTER,
  ];
};

test("gate skips pushes held by a draft PR and merge heads on both paths", () => {
  const scratch = join(import.meta.dir, "../../.scratch");
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, "draft-gate-"));
  writeFileSync(
    join(dir, "gh"),
    '#!/bin/bash\nprintf "%s\\0" "$@" > "$GH_ARGS"\nwhile [ $# -gt 0 ]; do [ "$1" = --jq ] && filter=$2; shift; done\nprintf "%s" "$GH_RESPONSE" | jq -r "$filter"\n',
    { mode: 0o700 },
  );
  try {
    for (const [index, c] of cases.entries()) {
      const output = join(dir, `output-${index}`);
      const ghArgs = join(dir, `gh-args-${index}`);
      const result = Bun.spawnSync(["bash", "-c", step.run], {
        cwd: dir,
        env: {
          ...process.env,
          ...step.env,
          PATH: `${dir}:${process.env.PATH}`,
          GITHUB_EVENT_NAME: c.event,
          GITHUB_REPOSITORY: "owner/repo",
          GITHUB_OUTPUT: output,
          HEAD_REF: "feature",
          HEAD_SHA: "abc123",
          HEAD_MESSAGE:
            c.event === "push" ? (c.message ?? "Add a feature") : "",
          PUSHED_AT: String(pushedAt),
          GH_RESPONSE: c.response,
          GH_ARGS: ghArgs,
        },
      });
      if (result.exitCode !== 0)
        throw new Error(`${c.name}: ${result.stderr.toString()}`);
      expect(readFileSync(output, "utf8").trim(), c.name).toBe(
        `review=${c.expected}`,
      );
      expect(
        existsSync(ghArgs)
          ? readFileSync(ghArgs, "utf8").split("\0").slice(0, -1)
          : null,
        c.name,
      ).toEqual(expectedGhArgs(c));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
