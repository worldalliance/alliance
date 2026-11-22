import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import {
  type AgentApi,
  type CreatedTask,
  IpcChannel,
  type IpcResult,
} from "../../shared/ipc";
import type { Problem } from "../../shared/repository";
import { agentArg, idArg, parseArg, textArg, toIpc } from "../ipc-args";
import { rendererIpc } from "../renderer-ipc";
import type { TaskService } from "./service";

const createArgs = z.strictObject({
  creationId: idArg,
  request: textArg,
  agent: agentArg,
}) satisfies z.ZodType<Parameters<AgentApi["createTask"]>[0]>;

// The problem's details reach the window through the task's state.
const created = (
  result: Result<CreatedTask, Problem>,
): IpcResult<CreatedTask> => R.mapError(result, ({ message }) => message);

/** Registers the renderer's task handlers and forwards each change to the window. */
export function registerTaskIpc(params: {
  tasks: TaskService;
  rendererUrl: string;
}): void {
  const { tasks } = params;
  const { handle, on, toRenderer } = rendererIpc(params.rendererUrl);
  tasks.subscribe((state) => toRenderer(IpcChannel.TasksChanged, state));

  handle(IpcChannel.TasksState, () => R.success(tasks.current()));
  handle(IpcChannel.CreateTask, async (_, input) => {
    const args = parseArg(createArgs, input);
    return args.ok ? created(await tasks.create(args.value)) : toIpc(args);
  });
  handle(IpcChannel.RetryTask, async (_, key) => {
    const parsed = parseArg(idArg, key);
    return parsed.ok ? created(await tasks.retry(parsed.value)) : toIpc(parsed);
  });
  on(IpcChannel.DismissTask, (key) => {
    const parsed = parseArg(idArg, key);
    if (!parsed.ok)
      return console.error(`DismissTask: ${parsed.error.message}`);
    tasks.dismiss(parsed.value);
  });
}
