import { type FormSchema } from "@alliance/common/forms/form-schema";
import { formulaSourceFormIds } from "@alliance/common/forms/formula-options";
import { storedQuestionFields } from "@alliance/common/forms/stored-schema";
import { type SourceFormFields } from "@alliance/common/forms/variable-scope";
import { In, type Repository } from "typeorm";
import type { Form } from "./entities/form.entity";
import { formSchemaOf } from "./form-snapshot-schema";

/**
 * The current question fields of every form `schema`'s variables and options
 * formulas read. A form that is gone or unreadable is left out, which
 * validation reports.
 */
export async function loadFormulaSourceForms(params: {
  formRepository: Repository<Form>;
  schema: FormSchema;
}): Promise<SourceFormFields> {
  const ids = formulaSourceFormIds(params.schema);
  if (ids.length === 0) return new Map();
  const forms = await params.formRepository.find({
    where: { id: In(ids) },
    relations: { formSnapshot: true },
  });
  return new Map(
    forms.flatMap((form) => {
      const fields = storedQuestionFields(formSchemaOf(form.formSnapshot));
      return fields.ok ? [[form.id, fields.value] as const] : [];
    }),
  );
}

/**
 * Other forms whose current version has a variable or options formula reading
 * `formId`'s answers. A form counting its own answers doesn't keep itself from
 * deletion.
 */
export function findFormsReadingForm(params: {
  formRepository: Repository<Form>;
  formId: number;
}): Promise<Form[]> {
  return params.formRepository
    .createQueryBuilder("form")
    .innerJoin("form.formSnapshot", "snapshot")
    .where(
      `(jsonb_path_exists(snapshot.schema, '$.variables[*].inputs.*.sourceFormId ? (@ == $id)', jsonb_build_object('id', :formId::int))
        OR jsonb_path_exists(snapshot.schema, 'lax $.pages[*].**.optionsFormula.inputs.*.sourceFormId ? (@ == $id)', jsonb_build_object('id', :formId::int)))`,
      { formId: params.formId },
    )
    .andWhere("form.id != :formId")
    .orderBy("form.id")
    .getMany();
}
