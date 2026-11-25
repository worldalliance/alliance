import {
  readDisplayOnlySchemaForMember,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type { Unrenderable } from "@alliance/common/forms/unrenderable";
import type { Result } from "@alliance/common/result";
import type { GeneralUpdateDto } from "../client";

export type ParsedGeneralUpdate = Omit<GeneralUpdateDto, "schema"> & {
  schema: Result<DisplayOnlySchema, Unrenderable>;
};

export function parseGeneralUpdate(dto: GeneralUpdateDto): ParsedGeneralUpdate {
  return { ...dto, schema: readDisplayOnlySchemaForMember(dto.schema) };
}
