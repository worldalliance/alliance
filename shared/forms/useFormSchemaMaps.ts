import {
  collectFieldLookup,
  isDisplayBlock,
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { useMemo } from "react";
import {
  findUnknownConditionKind,
  findUnknownFormElementKind,
} from "../formrenderer";
import { resolveFieldDefaultValue } from "./formDrafts";

export function useFormSchemaMaps(args: {
  schema: FormSchema;
  userDefaultPublic: boolean;
  /** Seeds every timezone field, whatever default the field names. */
  timeZone: string | undefined;
}): {
  fieldLookup: Map<string, AnyField>;
  defaultValueMap: Map<string, FormValue>;
  unknownKind: string | null;
  hasUserLocationDisplayBlock: boolean;
  outputFieldDefaultPublic: Map<string, boolean>;
  outputFieldIds: Set<string>;
  pageCount: number;
  maxPageIndex: number;
} {
  const { schema, userDefaultPublic, timeZone } = args;

  const { fieldLookup, defaultValueMap } = useMemo(() => {
    const defaults = new Map<string, FormValue>();

    for (const page of schema.pages) {
      for (const element of page.fields) {
        if (isQuestionField(element)) {
          const defaultValue = resolveFieldDefaultValue(element, timeZone);
          if (defaultValue !== undefined) {
            defaults.set(element.id, defaultValue);
          }
        }
      }
    }

    return {
      fieldLookup: collectFieldLookup(schema.pages),
      defaultValueMap: defaults,
    };
  }, [schema, timeZone]);

  const unknownKind = useMemo(
    () =>
      findUnknownFormElementKind(schema) ?? findUnknownConditionKind(schema),
    [schema],
  );

  const hasUserLocationDisplayBlock = useMemo(
    () =>
      schema.pages?.some((page) =>
        (page.fields ?? []).some(
          (element) =>
            isDisplayBlock(element) && element.kind === "userLocation",
        ),
      ) ?? false,
    [schema],
  );

  const outputFieldDefaultPublic = useMemo(() => {
    const defaults = new Map<string, boolean>();
    for (const page of schema.pages ?? []) {
      for (const element of page.fields ?? []) {
        if (isQuestionField(element) && element.output?.output) {
          defaults.set(
            element.id,
            element.output.privateByDefault ? false : userDefaultPublic,
          );
        }
      }
    }
    return defaults;
  }, [schema, userDefaultPublic]);

  const outputFieldIds = useMemo(
    () => new Set<string>(outputFieldDefaultPublic.keys()),
    [outputFieldDefaultPublic],
  );

  const pageCount = schema.pages?.length ?? 0;

  return {
    fieldLookup,
    defaultValueMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    pageCount,
    maxPageIndex: Math.max(0, (pageCount || 1) - 1),
  };
}
