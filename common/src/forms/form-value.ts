import { z } from "zod";
import { cityFieldValueSchema, type CityFieldValue } from "./city";
import { isListRow } from "./list-rows";

export type { CityFieldValue } from "./city";
export { isListRow } from "./list-rows";

export type ListFieldValue = Record<string, FormValue>[];
export type FormValue =
  | string
  | number
  | boolean
  | string[]
  | CityFieldValue
  | ListFieldValue;

export function asCards(value: FormValue | undefined): ListFieldValue | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.every(isListRow) ? value : null;
}

export function formValueSchemaWith(
  citySchema: z.ZodType<CityFieldValue>,
): z.ZodType<FormValue> {
  const self: z.ZodType<FormValue> = z.lazy(() =>
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      citySchema,
      z.array(z.record(z.string(), self)),
    ]),
  );
  return self;
}

export const formValueSchema = formValueSchemaWith(cityFieldValueSchema);
