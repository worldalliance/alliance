import { z } from "zod";
import { R, type Result } from "../result";
import { formValueSchema } from "./form-schema";

export const FORM_RESPONSES_BY_FORMS_MAX_BATCH = 100;

/**
 * Ceiling on a draft's serialized answers. Drafts are stored unvalidated, so
 * this is what stops a form from being used as arbitrary jsonb storage.
 */
export const FORM_DRAFT_MAX_ANSWER_BYTES = 256 * 1024;

const formAnswersSchema = z.record(z.string(), formValueSchema);
export type FormAnswers = z.infer<typeof formAnswersSchema>;

export function readFormAnswers(
  value: unknown,
): Result<FormAnswers, z.ZodError> {
  const parsed = formAnswersSchema.safeParse(value);
  return parsed.success ? R.success(parsed.data) : R.failure(parsed.error);
}
