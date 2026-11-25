import {
  collectFieldLookup,
  isDisplayBlock,
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { useMemo } from "react";
import {
  findUncompilableFormula,
  findUnknownConditionKind,
  findUnknownFormElementKind,
  findUnknownVariableInputKind,
} from "../formrenderer";
import { resolveFieldDefaultValue } from "./formDrafts";

/** A phone question that fills the profile, which the member's number seeds. */
const isProfilePhoneField = (element: PageItem): boolean =>
  isQuestionField(element) &&
  element.kind === "phone" &&
  !!element.autoExtractUserData;

/** Whether the form seeds answers from the member, so a host mounting it before the member loads would seed them without the member's values. */
export const seedsFromMember = (schema: FormSchema): boolean =>
  schema.pages.some((page) =>
    page.fields.some(
      (item) => item.kind === "timezone" || isProfilePhoneField(item),
    ),
  );

export function useFormSchemaMaps(args: {
  schema: FormSchema;
  userDefaultPublic: boolean;
  /** Seeds every timezone field, whatever default the field names. */
  timeZone: string | undefined;
  /** Seeds every phone field that fills the profile, over the field's default. */
  profilePhoneNumber: string | null | undefined;
}): {
  fieldLookup: Map<string, AnyField>;
  defaultValueMap: Map<string, FormValue>;
  /** The phone questions prefilled with the member's number. */
  profilePhoneDefaultMap: Map<string, FormValue>;
  unknownKind: string | null;
  hasUserLocationDisplayBlock: boolean;
  outputFieldDefaultPublic: Map<string, boolean>;
  outputFieldIds: Set<string>;
  pageCount: number;
  maxPageIndex: number;
} {
  const { schema, userDefaultPublic, timeZone, profilePhoneNumber } = args;

  const { fieldLookup, defaultValueMap, profilePhoneDefaultMap } =
    useMemo(() => {
      const defaults = new Map<string, FormValue>();
      const profilePhoneDefaults = new Map<string, FormValue>();

      for (const page of schema.pages) {
        for (const element of page.fields) {
          if (isQuestionField(element)) {
            const profilePhone =
              isProfilePhoneField(element) && profilePhoneNumber
                ? profilePhoneNumber
                : undefined;
            const defaultValue =
              profilePhone ?? resolveFieldDefaultValue(element, timeZone);
            if (defaultValue !== undefined) {
              defaults.set(element.id, defaultValue);
            }
            if (profilePhone) {
              profilePhoneDefaults.set(element.id, profilePhone);
            }
          }
        }
      }

      return {
        fieldLookup: collectFieldLookup(schema.pages),
        defaultValueMap: defaults,
        profilePhoneDefaultMap: profilePhoneDefaults,
      };
    }, [schema, timeZone, profilePhoneNumber]);

  const unknownKind = useMemo(
    () =>
      findUnknownFormElementKind(schema) ??
      findUnknownConditionKind(schema) ??
      findUnknownVariableInputKind(schema) ??
      findUncompilableFormula(schema),
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
    profilePhoneDefaultMap,
    unknownKind,
    hasUserLocationDisplayBlock,
    outputFieldDefaultPublic,
    outputFieldIds,
    pageCount,
    maxPageIndex: Math.max(0, (pageCount || 1) - 1),
  };
}
