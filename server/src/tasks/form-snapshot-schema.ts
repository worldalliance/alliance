import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormSnapshot } from "./entities/formsnapshot.entity";

export function formSchemaOf(snapshot: FormSnapshot): FormSchema {
  // Stored rows have formSchema's shape, but some fail refinements added
  // after they were written, so parsing here would break those forms.
  return snapshot.schema as FormSchema;
}
