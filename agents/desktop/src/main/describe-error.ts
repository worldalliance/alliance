import { z } from "zod";
import { R } from "../../../../common/src/result";

export const describeError = (error: unknown): string =>
  error instanceof z.ZodError
    ? z.prettifyError(error)
    : R.toError(error).message;
