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

let fetching: Promise<unknown> = Promise.resolve();

/** Fetches the repository's main and returns its commit, one fetch at a time, since two at once would race on FETCH_HEAD. A caller whose signal aborts stops waiting for its turn; one aborted once its fetch has started resolves after git exits. */
export function fetchMain(
  params: FetchParams,
): Promise<Result<string, Problem>> {
  const previous = fetching;
  const turn = Promise.race([previous, whenAborted(params.signal)]).then(() =>
    params.signal.aborted ? cancelled : fetchNow(params),
  );
  // A caller that stops waiting doesn't free the turn: the next fetch still waits for the one before it.
  fetching = Promise.all([previous, turn]).catch(() => undefined);
  return turn;
}

const cancelled = R.failure({ message: "The download was cancelled." });

const whenAborted = (signal: AbortSignal) =>
  new Promise<typeof cancelled>((resolve) => {
    if (signal.aborted) resolve(cancelled);
    signal.addEventListener("abort", () => resolve(cancelled), { once: true });
  });

async function fetchNow(params: FetchParams): Promise<Result<string, Problem>> {
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
