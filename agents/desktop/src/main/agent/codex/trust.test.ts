import { afterAll, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { R } from "../../../../../../common/src/result";
import { setEnv } from "../../../../../../common/src/set-env";
import { gitEnvironment } from "../../git-environment";
import { RpcConnection } from "./rpc";
import { trustRepositoryHooks } from "./trust";

const scratch = realpathSync(
  mkdtempSync(path.join(tmpdir(), "codex-trust-test-")),
);
const main = path.join(scratch, "main");
const worktree = path.join(scratch, "worktree");
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=x", "-c", "user.email=x@example.com", ...args],
    { cwd, stdio: "ignore", env: gitEnvironment() },
  );
git(scratch, "init", "-q", main);
git(main, "commit", "-q", "--allow-empty", "-m", "init");
git(main, "worktree", "add", "-q", worktree);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

type Hook = {
  key: string;
  source: string;
  currentHash: string;
  trustStatus: string;
};

type Problems = {
  warnings: string[];
  errors: { path: string; message: string }[];
};

/** Answers hooks/list with each listing in turn, config/read with layers, and every other request with {}, recording the requests. */
function scriptedAppServer(
  listings: Hook[][],
  problems: Problems = { warnings: [], errors: [] },
  layers: unknown[] = [],
) {
  const input = new PassThrough();
  const output = new PassThrough();
  const requests: { method: string; params: unknown }[] = [];
  output.setEncoding("utf8").on("data", (chunk: string) => {
    for (const line of chunk.trim().split("\n")) {
      const { id, method, params } = JSON.parse(line);
      requests.push({ method, params });
      const result =
        method === "hooks/list"
          ? {
              data: [
                {
                  cwd: worktree,
                  hooks: listings.shift() ?? [],
                  ...problems,
                },
              ],
            }
          : method === "config/read"
            ? { layers }
            : {};
      input.write(`${JSON.stringify({ id, result })}\n`);
    }
  });
  const rpc = new RpcConnection({
    input,
    output,
    onNotification: () => undefined,
    onServerRequest: () => undefined,
    onUnreadable: () => undefined,
  });
  return { rpc, requests };
}

const hook = (key: string, trustStatus: string, source = "project"): Hook => ({
  key,
  source,
  currentHash: `sha256:${key}`,
  trustStatus,
});

test("trusts a worktree's main checkout, then the hooks not yet trusted, and confirms them", async () => {
  const { rpc, requests } = scriptedAppServer([
    [
      hook("stop", "untrusted"),
      hook("start", "trusted"),
      hook("end", "modified"),
    ],
    [hook("stop", "trusted"), hook("start", "trusted"), hook("end", "trusted")],
  ]);
  expect(await trustRepositoryHooks(rpc, worktree)).toEqual(
    R.success(undefined),
  );
  expect(requests).toEqual([
    {
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: "projects",
            value: { [main]: { trust_level: "trusted" } },
            mergeStrategy: "upsert",
          },
        ],
        reloadUserConfig: true,
      },
    },
    { method: "config/read", params: { includeLayers: true, cwd: worktree } },
    { method: "hooks/list", params: { cwds: [worktree] } },
    {
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: "hooks.state",
            value: {
              stop: { trusted_hash: "sha256:stop" },
              end: { trusted_hash: "sha256:end" },
            },
            mergeStrategy: "upsert",
          },
        ],
        reloadUserConfig: true,
      },
    },
    { method: "hooks/list", params: { cwds: [worktree] } },
  ]);
});

test("writes no hook trust when every hook is already trusted or managed", async () => {
  const { rpc, requests } = scriptedAppServer([
    [hook("stop", "trusted"), hook("policy", "managed")],
  ]);
  expect(await trustRepositoryHooks(rpc, main)).toEqual(R.success(undefined));
  expect(requests.map((r) => r.method)).toEqual([
    "config/batchWrite",
    "config/read",
    "hooks/list",
  ]);
});

test("fails, naming each hook Codex still doesn't trust after the write", async () => {
  const { rpc } = scriptedAppServer([
    [hook("stop", "untrusted")],
    [hook("stop", "modified")],
  ]);
  const trusted = await trustRepositoryHooks(rpc, worktree);
  expect(trusted.ok ? "" : trusted.error.message).toBe(
    "Codex still doesn't trust these hooks after Alliance agent trusted them: stop (modified)",
  );
});

test("fails on an untrusted hook that appears only in the confirming listing", async () => {
  const { rpc } = scriptedAppServer([
    [hook("stop", "untrusted")],
    [hook("stop", "trusted"), hook("new", "untrusted")],
  ]);
  const trusted = await trustRepositoryHooks(rpc, worktree);
  expect(trusted.ok ? "" : trusted.error.message).toBe(
    "Codex still doesn't trust these hooks after Alliance agent trusted them: new (untrusted)",
  );
});

test("fails, naming each problem, when Codex can't load the repository's hooks", async () => {
  const { rpc } = scriptedAppServer([[]], {
    warnings: ["failed to parse hooks config"],
    errors: [{ path: "hooks.json", message: "unreadable" }],
  });
  const trusted = await trustRepositoryHooks(rpc, worktree);
  expect(trusted.ok ? "" : trusted.error.message).toBe(
    "Codex couldn't load some or all of the repository's hooks, so they wouldn't run: failed to parse hooks config; hooks.json: unreadable",
  );
});

const hookedRepository = (name: string, hooksFile: string) => {
  const hooked = path.join(scratch, name);
  git(scratch, "init", "-q", hooked);
  mkdirSync(path.join(hooked, ".codex"));
  writeFileSync(path.join(hooked, ".codex", "hooks.json"), hooksFile);
  return hooked;
};

test("fails when Codex lists fewer hooks than the main checkout's hooks file defines, as for an event it doesn't support or a project it doesn't trust, from the checkout or a worktree with its own hooks file", async () => {
  const handler = { type: "command", command: "true" };
  const hooked = hookedRepository(
    "hooked",
    JSON.stringify({
      hooks: { Stop: [{ hooks: [handler] }], Bogus: [{ hooks: [handler] }] },
    }),
  );
  git(hooked, "commit", "-q", "--allow-empty", "-m", "init");
  const hookedWorktree = path.join(scratch, "hooked-worktree");
  git(hooked, "worktree", "add", "-q", hookedWorktree);
  mkdirSync(path.join(hookedWorktree, ".codex"));
  writeFileSync(
    path.join(hookedWorktree, ".codex", "hooks.json"),
    JSON.stringify({ hooks: { Stop: [{ hooks: [handler] }] } }),
  );
  const hooksFile = path.join(hooked, ".codex", "hooks.json");
  for (const [folder, listed, count] of [
    [hooked, [hook("stop", "trusted")], 1],
    [
      hooked,
      [hook("stop", "trusted"), hook("user-stop", "trusted", "user")],
      1,
    ],
    [hooked, [], 0],
    [hookedWorktree, [hook("stop", "trusted")], 1],
  ] as const) {
    const { rpc } = scriptedAppServer([[...listed]]);
    const trusted = await trustRepositoryHooks(rpc, folder);
    expect(trusted.ok ? "" : trusted.error.message).toStartWith(
      `Codex finds ${count} of the 2 hooks in ${hooksFile}, so the rest wouldn't run.`,
    );
  }
});

test("refuses, before writing any trust, any folder but the top of a checkout or a linked worktree of one", async () => {
  const superproject = path.join(scratch, "super");
  git(scratch, "init", "-q", superproject);
  git(
    superproject,
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "-q",
    main,
    "lib",
  );
  git(scratch, "clone", "-q", "--bare", main, "bare.git");
  git(
    path.join(scratch, "bare.git"),
    "worktree",
    "add",
    "-q",
    path.join(scratch, "bare-worktree"),
  );
  const moved = path.join(scratch, "moved");
  git(scratch, "clone", "-q", main, moved);
  git(moved, "worktree", "add", "-q", path.join(scratch, "orphaned"));
  rmSync(path.join(moved, ".git", "worktrees"), { recursive: true });
  mkdirSync(path.join(main, "sub"));
  mkdirSync(path.join(scratch, "store"));
  const separate = path.join(scratch, "separate");
  git(
    scratch,
    "init",
    "-q",
    "--separate-git-dir",
    path.join(scratch, "store", ".git"),
    separate,
  );
  git(scratch, "clone", "-q", "--bare", main, path.join("bare-dot", ".git"));
  git(
    path.join(scratch, "bare-dot", ".git"),
    "worktree",
    "add",
    "-q",
    path.join(scratch, "bare-dot-worktree"),
  );
  const pointed = path.join(scratch, "pointed");
  git(scratch, "clone", "-q", main, pointed);
  git(pointed, "worktree", "add", "-q", path.join(scratch, "pointed-worktree"));
  git(pointed, "config", "core.worktree", path.join(scratch, "store"));
  for (const folder of [
    path.join(scratch, "pointed-worktree"),
    separate,
    path.join(scratch, "bare-dot-worktree"),
    path.join(superproject, "lib"),
    path.join(scratch, "bare-worktree"),
    path.join(scratch, "orphaned"),
    path.join(main, "sub"),
    scratch,
  ]) {
    const { rpc, requests } = scriptedAppServer([]);
    const trusted = await trustRepositoryHooks(rpc, folder);
    expect(trusted.ok ? "" : trusted.error.message).toStartWith(
      "Alliance agent runs Codex only at the top of a checkout",
    );
    expect(requests).toEqual([]);
  }
}, 30_000);

test("refuses, before listing hooks, a project config.toml that defines hooks, naming the main checkout's file, which a worktree's layer holds too, since only hooks.json is counted", async () => {
  for (const folder of [main, worktree]) {
    const { rpc, requests } = scriptedAppServer(
      [],
      { warnings: [], errors: [] },
      [
        { name: { type: "user", file: "/home/config.toml" }, config: {} },
        {
          name: {
            type: "project",
            dotCodexFolder: path.join(folder, ".codex"),
          },
          config: { hooks: {} },
        },
      ],
    );
    const trusted = await trustRepositoryHooks(rpc, folder);
    expect(trusted.ok ? "" : trusted.error.message).toStartWith(
      `Alliance agent checks that Codex runs a repository's hooks only in .codex/hooks.json, so it won't start while ${path.join(main, ".codex", "config.toml")} defines hooks.`,
    );
    expect(requests.map((request) => request.method)).toEqual([
      "config/batchWrite",
      "config/read",
    ]);
  }
});

test("fails when it can't read the repository's hooks file", async () => {
  const hooked = hookedRepository("unreadable", "{");
  const { rpc } = scriptedAppServer([[hook("stop", "trusted")]]);
  const trusted = await trustRepositoryHooks(rpc, hooked);
  expect(trusted.ok ? "" : trusted.error.message).toStartWith(
    `couldn't read ${path.join(hooked, ".codex", "hooks.json")} as event groups of hooks`,
  );
});

test("trusts a repository whose hooks file defines no hooks", async () => {
  for (const [name, hooksFile] of [
    ["empty", "{}"],
    ["no-handlers", JSON.stringify({ hooks: { Stop: [{ hooks: [] }] } })],
  ]) {
    const { rpc } = scriptedAppServer([[]]);
    expect(
      await trustRepositoryHooks(rpc, hookedRepository(name, hooksFile)),
    ).toEqual(R.success(undefined));
  }
});

test("finds the main checkout from the folder, whatever GIT_DIR the app inherited", async () => {
  const inherited = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(scratch, "elsewhere");
  try {
    const { rpc, requests } = scriptedAppServer([[]]);
    expect(await trustRepositoryHooks(rpc, worktree)).toEqual(
      R.success(undefined),
    );
    expect(requests[0]?.params).toMatchObject({
      edits: [{ value: { [main]: { trust_level: "trusted" } } }],
    });
  } finally {
    setEnv("GIT_DIR", inherited);
  }
});

test("fails when git can't run", async () => {
  const inherited = process.env.PATH;
  process.env.PATH = path.join(scratch, "no-git");
  try {
    const { rpc, requests } = scriptedAppServer([]);
    const trusted = await trustRepositoryHooks(rpc, worktree);
    expect(trusted.ok ? "" : trusted.error.message).toContain(
      `git couldn't find one at ${worktree}:`,
    );
    expect(requests).toEqual([]);
  } finally {
    setEnv("PATH", inherited);
  }
});
