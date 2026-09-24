import { z } from "zod";
import { R, type Result } from "../result";
import { storedCityValueSchema } from "./city";
import { formValueSchema, formValueSchemaWith } from "./form-schema";

export const FORM_RESPONSES_BY_FORMS_MAX_BATCH = 100;

/**
 * Ceiling on a draft's serialized answers and public/private choices together,
 * so a form can't be used as arbitrary jsonb storage.
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

const storedFormAnswersSchema = z.record(
  z.string(),
  formValueSchemaWith(storedCityValueSchema),
);

/**
 * Reads answers already saved, which {@link readFormAnswers} can reject: a city
 * saved with keys since dropped still reads, without them.
 */
export function readStoredFormAnswers(
  value: unknown,
): Result<FormAnswers, z.ZodError> {
  const parsed = storedFormAnswersSchema.safeParse(value);
  return parsed.success ? R.success(parsed.data) : R.failure(parsed.error);
}

const publicFormAnswersSchema = z.record(z.string(), z.boolean());
export type PublicFormAnswers = z.infer<typeof publicFormAnswersSchema>;

export function readPublicFormAnswers(
  value: unknown,
): Result<PublicFormAnswers, z.ZodError> {
  const parsed = publicFormAnswersSchema.safeParse(value);
  return parsed.success ? R.success(parsed.data) : R.failure(parsed.error);
}
