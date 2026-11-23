import path from "node:path";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import { AgentKind } from "../shared/agent-kind";
import type { IpcResult } from "../shared/ipc";

export const toIpc = <T>(result: Result<T, Error>): IpcResult<T> =>
  R.mapError(result, (error) => error.message);

export const folderArg = z
  .string()
  .refine(path.isAbsolute, "not an absolute path");
export const idArg = z.string().min(1);
export const agentArg = z.enum(AgentKind);
export const textArg = z
  .string()
  .refine((text) => text.trim().length > 0, "an empty message");

export function parseArg<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, Error> {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(
        new Error(`Invalid argument: ${z.prettifyError(parsed.error)}`),
      );
}
