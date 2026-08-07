import {
  readDisplayOnlySchema,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import type { GeneralUpdateDto } from "../client";

export type ParsedGeneralUpdate = Omit<GeneralUpdateDto, "schema"> & {
  schema: DisplayOnlySchema | null;
};

export function parseGeneralUpdate(dto: GeneralUpdateDto): ParsedGeneralUpdate {
  return { ...dto, schema: readDisplayOnlySchema(dto.schema) };
}
