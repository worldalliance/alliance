import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import {
  type FormSchemaValidationError,
  validateFormSchema,
} from "@alliance/common/forms/form-schema-validate";
import { R, type Result } from "@alliance/common/result";
import { issuePath } from "@alliance/common/zod-issues";
import { BadRequestException } from "@nestjs/common";
import type { Repository } from "typeorm";
import type { Form } from "./entities/form.entity";
import { loadFormulaSourceForms } from "./formula-source-forms";

type ParseFormSchemaParams = {
  formRepository: Repository<Form>;
  schema: unknown;
  /** The form being saved, or undefined for a new one. */
  formId: number | undefined;
};

async function validateFormSchemaInput(
  params: ParseFormSchemaParams,
): Promise<Result<FormSchema, FormSchemaValidationError[]>> {
  const parsed = formSchema.safeParse(params.schema);
  if (!parsed.success) {
    return R.failure(
      parsed.error.issues.map((issue) => ({
        blockId: issuePath(issue),
        message: issue.message,
      })),
    );
  }
  const errors = validateFormSchema(parsed.data, {
    formId: params.formId,
    sourceForms: await loadFormulaSourceForms({
      formRepository: params.formRepository,
      schema: parsed.data,
    }),
  });
  if (errors.length > 0) {
    return R.failure(errors);
  }
  return R.success(parsed.data);
}

export async function parseFormSchemaOrThrow(
  params: ParseFormSchemaParams,
): Promise<FormSchema> {
  const validated = await validateFormSchemaInput(params);
  if (!validated.ok) {
    throw new BadRequestException({
      message: "Invalid form schema",
      errors: validated.error,
    });
  }
  return validated.value;
}
