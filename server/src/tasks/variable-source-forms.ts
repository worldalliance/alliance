import type { Repository } from "typeorm";
import type { Form } from "./entities/form.entity";

/** Forms whose current version has a variable reading `formId`'s answers. */
export function findFormsReadingForm(params: {
  formRepository: Repository<Form>;
  formId: number;
}): Promise<Form[]> {
  return params.formRepository
    .createQueryBuilder("form")
    .innerJoin("form.formSnapshot", "snapshot")
    .where(
      `jsonb_path_exists(snapshot.schema, '$.variables[*].inputs.*.sourceFormId ? (@ == $id)', jsonb_build_object('id', :formId::int))`,
      { formId: params.formId },
    )
    .orderBy("form.id")
    .getMany();
}
