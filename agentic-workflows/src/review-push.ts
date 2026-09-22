import { R, type Result } from "@alliance/common/result";
import { z } from "zod";
import { gitText, lines } from "./git";
import { appendLog, spawnLogged, type StepContext } from "./jobs";

const DRAFT_REMOTE = "origin";

export type ReviewPushTarget = {
  remote: string;
  ref: string;
  parent: string;
  reviewedSha: string;
  localBranch: string;
  draftRef: string;
  draftTip: string;
};

export async function resolveReviewPush(params: {
  path: string;
  selectedRemote: string;
  reviewedSha: string;
}): Promise<Result<ReviewPushTarget, string>> {
  const remotes = await gitText({ args: ["remote"], cwd: params.path });
  if (!remotes.ok) return remotes;
  if (!lines(remotes.value).includes(DRAFT_REMOTE))
    return R.failure("Configure origin before backing up the draft branch.");
  const remote = lines(remotes.value)
    .sort((a, b) => b.length - a.length)
    .find((name) => params.selectedRemote.startsWith(`${name}/`));
  if (!remote)
    return R.failure("Select a remote branch before running review and push.");

  const trackingRef = `refs/remotes/${params.selectedRemote}`;
  const symbolic = await gitText({
    args: ["for-each-ref", "--format=%(symref)", trackingRef],
    cwd: params.path,
  });
  if (!symbolic.ok) return symbolic;
  if (symbolic.value.trim())
    return R.failure(
      "Select a concrete remote branch, not a symbolic ref such as origin/HEAD.",
    );

  const parent = await gitText({
    args: [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${trackingRef}^{commit}`,
    ],
    cwd: params.path,
  });
  if (!parent.ok) return parent;
  const ancestry = await gitText({
    args: ["rev-list", "--parents", "-n", "1", params.reviewedSha],
    cwd: params.path,
  });
  if (!ancestry.ok) return ancestry;
  if (
    ancestry.value.trim() !== `${params.reviewedSha} ${parent.value.trim()}`
  ) {
    return R.failure(
      "The reviewed commit must have exactly the selected remote tip as its only parent.",
    );
  }
  const localBranch = await gitText({
    args: ["symbolic-ref", "--short", "HEAD"],
    cwd: params.path,
  });
  if (!localBranch.ok)
    return R.failure(
      "Check out a local branch before running review and push.",
    );
  const ref = `refs/heads/${params.selectedRemote.slice(remote.length + 1)}`;
  const draftRef = `refs/heads/draft/${localBranch.value.trim()}`;
  if (remote === DRAFT_REMOTE && ref === draftRef)
    return R.failure(
      "The selected reviewed branch must be different from its draft backup branch.",
    );
  const draft = await gitText({
    args: ["ls-remote", "--refs", "--", DRAFT_REMOTE, draftRef],
    cwd: params.path,
  });
  if (!draft.ok) return draft;
  const advertised = draft.value.trim();
  const entry = z
    .tuple([z.string().regex(/^[a-f0-9]{40,64}$/), z.literal(draftRef)])
    .safeParse(advertised.split(/\s+/));
  if (advertised && !entry.success)
    return R.failure("The remote returned an invalid draft branch tip.");
  return R.success({
    remote,
    ref,
    parent: parent.value.trim(),
    reviewedSha: params.reviewedSha,
    localBranch: localBranch.value.trim(),
    draftRef,
    draftTip: entry.success ? entry.data[0] : "",
  });
}

export async function pushDraftBranch(params: {
  context: StepContext;
  path: string;
  target: ReviewPushTarget;
}): Promise<Result<string, string>> {
  const { target } = params;
  const branch = await gitText({
    args: ["symbolic-ref", "--short", "HEAD"],
    cwd: params.path,
  });
  if (!branch.ok) return branch;
  if (branch.value.trim() !== target.localBranch)
    return R.failure(
      "The checked-out branch changed during review; the draft was not pushed.",
    );
  const head = await gitText({
    args: ["rev-parse", "--verify", "HEAD"],
    cwd: params.path,
  });
  if (!head.ok) return head;
  return R.map(
    await spawnLogged({
      context: params.context,
      command: [
        "git",
        "push",
        "--porcelain",
        "--no-follow-tags",
        "--recurse-submodules=no",
        `--force-with-lease=${target.draftRef}:${target.draftTip}`,
        "--",
        DRAFT_REMOTE,
        `${head.value.trim()}:${target.draftRef}`,
      ],
      cwd: params.path,
      onStdout: (line) => appendLog(params.context.step, line),
    }),
    () =>
      `Backed up committed work through ${head.value.trim()} to ${DRAFT_REMOTE}/${target.draftRef.slice("refs/heads/".length)}.`,
  );
}

export async function pushReviewedCommit(params: {
  context: StepContext;
  path: string;
  target: ReviewPushTarget;
}): Promise<Result<string, string>> {
  const { target } = params;
  const stillPending = await gitText({
    args: ["merge-base", "--is-ancestor", target.reviewedSha, "HEAD"],
    cwd: params.path,
  });
  if (!stillPending.ok)
    return R.failure(
      "The reviewed commit is no longer on this branch; run a fresh review before pushing.",
    );

  return R.map(
    await spawnLogged({
      context: params.context,
      command: [
        "git",
        "push",
        "--porcelain",
        "--no-follow-tags",
        "--recurse-submodules=no",
        `--force-with-lease=${target.ref}:${target.parent}`,
        "--",
        target.remote,
        `${target.reviewedSha}:${target.ref}`,
      ],
      cwd: params.path,
      onStdout: (line) => appendLog(params.context.step, line),
    }),
    () =>
      `Pushed reviewed commit ${target.reviewedSha} to ${target.remote}/${target.ref.slice("refs/heads/".length)}.`,
  );
}
