import type { FormSchema } from "@alliance/common/forms/form-schema";
import { taskFlow } from "./copy";

export const completionSubtitle = (schema: FormSchema): string =>
  schema.completionSubtitle?.trim() || taskFlow.completeUpdate;
