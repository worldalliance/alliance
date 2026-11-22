import { R, type Result } from "../../../../../common/src/result";
import type { Problem } from "../../shared/repository";
import { failureOutput } from "../agent/cli-process";
import { stallLimit } from "./clone";
import type { Git } from "./git";
import { fetchTarget } from "./identify";

type FetchParams = {
  git: Git;
  checkout: string;
  url: string;
  signal: AbortSignal;
};

/** Fetches the repository's main and returns its commit. */
export async function fetchMain(
  params: FetchParams,
): Promise<Result<string, Problem>> {
  const { git, checkout, signal } = params;
  const target = await fetchTarget({ git, folder: checkout, url: params.url });
  if (!target.ok)
    return R.failure({
      message: `Alliance agent couldn't check ${checkout}.`,
      details: target.error.message,
    });
  if (signal.aborted) return cancelled;
  const fetched = await git.run({
    args: ["-C", checkout, ...stallLimit, "fetch", target.value, "main"],
    signal,
  });
  if (!fetched.ok || fetched.value.code !== 0)
    return R.failure({
      message:
        "Alliance agent couldn't download the latest main. Check your internet connection, then try again.",
      details: fetched.ok
        ? failureOutput("git fetch", fetched.value).message
        : fetched.error.message,
    });
  const commit = await git.output([
    "-C",
    checkout,
    "rev-parse",
    "--verify",
    "FETCH_HEAD^{commit}",
  ]);
  return commit.ok
    ? R.success(commit.value.trim())
    : R.failure({
        message: "Alliance agent couldn't read the main it downloaded.",
        details: commit.error.message,
      });
}

const cancelled = R.failure({ message: "The download was cancelled." });
