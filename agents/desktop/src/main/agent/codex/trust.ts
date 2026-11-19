import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { describeError } from "../../describe-error";
import { queryTimeoutMs } from "../cli-process";
import type { Fits } from "./fits";
import type { ConfigBatchWriteParams } from "./protocol/v2/ConfigBatchWriteParams.gen";
import type { ConfigLayer } from "./protocol/v2/ConfigLayer.gen";
import type { ConfigReadParams } from "./protocol/v2/ConfigReadParams.gen";
import type { HooksListParams } from "./protocol/v2/HooksListParams.gen";
import type { HooksListResponse } from "./protocol/v2/HooksListResponse.gen";
import type { HookSource } from "./protocol/v2/HookSource.gen";
import type { RpcConnection } from "./rpc";

const hooksList = z.object({
  data: z.array(
    z.object({
      hooks: z.array(
        z.object({
          key: z.string(),
          source: z.string(),
          currentHash: z.string(),
          trustStatus: z.enum(["managed", "untrusted", "trusted", "modified"]),
        }),
      ),
      warnings: z.array(z.string()),
      errors: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  ),
});
true satisfies Fits<typeof hooksList, HooksListResponse>;

const configLayer = z.object({
  name: z.looseObject({ dotCodexFolder: z.string().optional() }),
  config: z.unknown(),
});
true satisfies Fits<typeof configLayer, ConfigLayer>;
const configLayers = z.object({ layers: z.array(configLayer) });

// Codex also skips without a warning a hook under an unsupported event in a project's config.toml, and only hooks.json is counted, so hooks there are refused. Like hooks.json, a worktree's project layer holds the main checkout's file.
async function refuseConfigTomlHooks(
  rpc: RpcConnection,
  folders: { cwd: string; main: string },
): Promise<Result<void, Error>> {
  const read = R.flatMap(
    await rpc.request("config/read", {
      includeLayers: true,
      cwd: folders.cwd,
    } satisfies ConfigReadParams),
    (result) =>
      R.fromThrowable(
        () => configLayers.parse(result).layers,
        (error) =>
          new Error(`unexpected config/read result: ${describeError(error)}`),
      ),
  );
  if (!read.ok) return read;
  const definesHooks = read.value.some(
    ({ name, config }) =>
      name.dotCodexFolder !== undefined &&
      typeof config === "object" &&
      config !== null &&
      "hooks" in config,
  );
  return definesHooks
    ? R.failure(
        new Error(
          `Alliance agent checks that Codex runs a repository's hooks only in .codex/hooks.json, so it won't start while ${path.join(folders.main, ".codex", "config.toml")} defines hooks. Move them to .codex/hooks.json.`,
        ),
      )
    : R.success(undefined);
}

const hooksConfig = z.object({
  hooks: z
    .record(z.string(), z.array(z.object({ hooks: z.array(z.unknown()) })))
    .optional(),
});

const countHooks = (file: string): Result<number, Error> =>
  existsSync(file)
    ? R.fromThrowable(
        () =>
          Object.values(
            hooksConfig.parse(JSON.parse(readFileSync(file, "utf8"))).hooks ??
              {},
          )
            .flat()
            .reduce((count, group) => count + group.hooks.length, 0),
        (error) =>
          new Error(
            `couldn't read ${file} as event groups of hooks, so couldn't check Codex runs them: ${describeError(error)}`,
          ),
      )
    : R.success(0);

// A GIT_DIR or GIT_WORK_TREE inherited from a git hook or rebase would point git at another repository.
export const gitEnvironment = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );

const onlyAtCheckoutTop =
  "Alliance agent runs Codex only at the top of a checkout whose git directory is its .git folder, or of a linked worktree of one, since Codex runs the hooks of every .codex folder from there down and keys their trust by the folder holding .git";

const revParse = async (folder: string) =>
  R.map(
    await R.fromPromise(
      promisify(execFile)(
        "git",
        [
          "rev-parse",
          "--path-format=absolute",
          "--git-dir",
          "--git-common-dir",
          "--show-toplevel",
          "--show-prefix",
        ],
        { cwd: folder, env: gitEnvironment(), timeout: queryTimeoutMs },
      ),
    ),
    ({ stdout }) => {
      const [gitDir = "", commonDir = "", top = "", prefix = ""] = stdout
        .trim()
        .split("\n");
      return { gitDir, commonDir, top, prefix };
    },
  );

/** The main checkout whose trust Codex requires for folder, which must be the top of a checkout or of a linked worktree. */
async function findMainCheckout(
  folder: string,
): Promise<Result<string, Error>> {
  const found = await revParse(folder);
  if (!found.ok)
    return R.failure(
      new Error(
        `${onlyAtCheckoutTop}, and git couldn't find one at ${folder}: ${found.error.message}`,
      ),
    );
  const { gitDir, commonDir, top, prefix } = found.value;
  const main = path.dirname(commonDir);
  const fromMain =
    commonDir === path.join(main, ".git") ? await revParse(main) : undefined;
  return prefix === "" &&
    (top === main || gitDir !== commonDir) &&
    fromMain?.ok &&
    fromMain.value.top === main
    ? R.success(main)
    : R.failure(
        new Error(
          `${onlyAtCheckoutTop}, so it can't start in ${folder}, in the checkout at ${top}, whose git directory is ${commonDir}.`,
        ),
      );
}

// Codex reports a hooks file it can't parse, or a hook type it doesn't support, as a warning and leaves out what it couldn't load, so the session would run without it.
const listHooks = async (rpc: RpcConnection, cwd: string) =>
  R.flatMap(
    R.flatMap(
      await rpc.request("hooks/list", {
        cwds: [cwd],
      } satisfies HooksListParams),
      (result) =>
        R.fromThrowable(
          () => hooksList.parse(result).data,
          (error) =>
            new Error(`unexpected hooks/list result: ${describeError(error)}`),
        ),
    ),
    (entries) => {
      const problems = entries.flatMap((entry) => [
        ...entry.warnings,
        ...entry.errors.map((error) => `${error.path}: ${error.message}`),
      ]);
      return problems.length === 0
        ? R.success(entries.flatMap((entry) => entry.hooks))
        : R.failure(
            new Error(
              `Codex couldn't load some or all of the repository's hooks, so they wouldn't run: ${problems.join("; ")}`,
            ),
          );
    },
  );

const isUntrusted = (hook: { trustStatus: string }) =>
  hook.trustStatus !== "trusted" && hook.trustStatus !== "managed";

/** Trusts cwd's main checkout and every hook Codex now finds for cwd, as they currently are, in the private config, then fails unless Codex lists every hook as trusted. Fails too when a project config.toml defines hooks, or when Codex lists fewer project hooks than the main checkout's hooks file, the one Codex runs, defines. */
export async function trustRepositoryHooks(
  rpc: RpcConnection,
  cwd: string,
): Promise<Result<void, Error>> {
  const found = await findMainCheckout(cwd);
  if (!found.ok) return found;
  const main = found.value;
  const project = await rpc.request("config/batchWrite", {
    edits: [
      {
        keyPath: "projects",
        value: { [main]: { trust_level: "trusted" } },
        mergeStrategy: "upsert",
      },
    ],
    reloadUserConfig: true,
  } satisfies ConfigBatchWriteParams);
  if (!project.ok) return project;
  const tomlHooks = await refuseConfigTomlHooks(rpc, { cwd, main });
  if (!tomlHooks.ok) return tomlHooks;
  const hooks = await listHooks(rpc, cwd);
  if (!hooks.ok) return hooks;
  // Codex leaves out, without a warning, a hook under an event it doesn't support; counting only project hooks keeps a user's or managed hook from hiding that.
  const hooksFile = path.join(main, ".codex", "hooks.json");
  const defined = countHooks(hooksFile);
  if (!defined.ok) return defined;
  const listed = hooks.value.filter(
    (hook) => hook.source === ("project" satisfies HookSource),
  ).length;
  if (listed < defined.value)
    return R.failure(
      new Error(
        `Codex finds ${listed} of the ${defined.value} hooks in ${hooksFile}, so the rest wouldn't run. Codex skips a hook under an event it doesn't support, and runs this file, the main checkout's, in each of its worktrees.`,
      ),
    );
  const untrusted = hooks.value.filter(isUntrusted);
  if (untrusted.length === 0) return R.success(undefined);
  const written = await rpc.request("config/batchWrite", {
    edits: [
      {
        keyPath: "hooks.state",
        value: Object.fromEntries(
          untrusted.map((hook) => [
            hook.key,
            { trusted_hash: hook.currentHash },
          ]),
        ),
        mergeStrategy: "upsert",
      },
    ],
    reloadUserConfig: true,
  } satisfies ConfigBatchWriteParams);
  if (!written.ok) return written;
  const confirmed = await listHooks(rpc, cwd);
  if (!confirmed.ok) return confirmed;
  const stillUntrusted = confirmed.value.filter(isUntrusted);
  return stillUntrusted.length === 0
    ? R.success(undefined)
    : R.failure(
        new Error(
          `Codex still doesn't trust these hooks after Alliance agent trusted them: ${stillUntrusted.map((hook) => `${hook.key} (${hook.trustStatus})`).join(", ")}`,
        ),
      );
}
