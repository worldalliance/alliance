import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import {
  type AgentApi,
  type CreatedWorktree,
  IpcChannel,
  type IpcResult,
} from "../../shared/ipc";
import type { Problem } from "../../shared/repository";
import { idArg, parseArg, textArg, toIpc } from "../ipc-args";
import { rendererIpc } from "../renderer-ipc";
import type { WorktreeService } from "./service";

const createArgs = z.strictObject({
  creationId: idArg,
  name: textArg,
}) satisfies z.ZodType<Parameters<AgentApi["createWorktree"]>[0]>;

// The problem's details reach the window through the worktree's state.
const created = (
  result: Result<CreatedWorktree, Problem>,
): IpcResult<CreatedWorktree> => R.mapError(result, ({ message }) => message);

/** Registers the renderer's worktree handlers and forwards each change to the window. */
export function registerWorktreeIpc(params: {
  worktrees: WorktreeService;
  rendererUrl: string;
}): void {
  const { worktrees } = params;
  const { handle, on, toRenderer } = rendererIpc(params.rendererUrl);
  worktrees.subscribe((state) =>
    toRenderer(IpcChannel.WorktreesChanged, state),
  );

  handle(IpcChannel.WorktreesState, () => R.success(worktrees.current()));
  handle(IpcChannel.CreateWorktree, async (_, input) => {
    const args = parseArg(createArgs, input);
    return args.ok ? created(await worktrees.create(args.value)) : toIpc(args);
  });
  handle(IpcChannel.RetryWorktree, async (_, key) => {
    const parsed = parseArg(idArg, key);
    return parsed.ok
      ? created(await worktrees.retry(parsed.value))
      : toIpc(parsed);
  });
  on(IpcChannel.DismissWorktree, (key) => {
    const parsed = parseArg(idArg, key);
    if (!parsed.ok)
      return console.error(`DismissWorktree: ${parsed.error.message}`);
    worktrees.dismiss(parsed.value);
  });
  handle(IpcChannel.ArchiveWorktree, async (_, key) => {
    const parsed = parseArg(idArg, key);
    return toIpc(parsed.ok ? await worktrees.archive(parsed.value) : parsed);
  });
  handle(IpcChannel.RestoreWorktree, async (_, key) => {
    const parsed = parseArg(idArg, key);
    return toIpc(parsed.ok ? await worktrees.restore(parsed.value) : parsed);
  });
}
