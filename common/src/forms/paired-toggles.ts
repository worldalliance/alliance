import type { AnyField, FormValue, ToggleField } from "./form-schema";

/** Whether a toggle's `atLeastOneOnWith` partner not being on makes it required. */
export const pairedToggleRequired = (
  field: AnyField,
  data: Record<string, FormValue>,
): boolean =>
  field.kind === "toggle" &&
  field.atLeastOneOnWith !== undefined &&
  data[field.atLeastOneOnWith] !== true;

/** The toggles `atLeastOneOnWith` pairs with the toggle `fieldId`, from either side. */
export function pairedToggles(
  fieldId: string,
  fields: Iterable<AnyField>,
): ToggleField[] {
  const toggles = [...fields].filter(
    (field): field is ToggleField => field.kind === "toggle",
  );
  const changed = toggles.find((field) => field.id === fieldId);
  if (!changed) return [];
  return toggles.filter(
    (field) =>
      field.id !== fieldId &&
      (field.atLeastOneOnWith === fieldId ||
        changed.atLeastOneOnWith === field.id),
  );
}

/**
 * The toggle to turn on after `fieldId` turns off with no visible partner on:
 * a visible partner, or `fieldId` itself when every partner is hidden. Null
 * otherwise.
 */
export function pairedToggleToTurnOn(params: {
  fieldId: string;
  data: Record<string, FormValue>;
  partners: readonly ToggleField[];
  isVisible: (field: AnyField) => boolean;
}): string | null {
  const { fieldId, data, partners, isVisible } = params;
  if (partners.length === 0 || data[fieldId] !== false) return null;
  const visible = partners.filter(isVisible);
  if (visible.some((field) => data[field.id] === true)) return null;
  return visible[0]?.id ?? fieldId;
}

/**
 * A toggle whose `atLeastOneOnWith` names no other toggle in the form would
 * always be required with nothing to turn on, so the form doesn't save.
 */
export function pairedToggleErrors(
  fieldLookup: ReadonlyMap<string, AnyField>,
): { blockId: string; message: string }[] {
  return [...fieldLookup.values()].flatMap((field) => {
    if (field.kind !== "toggle" || field.atLeastOneOnWith === undefined) {
      return [];
    }
    const partner = fieldLookup.get(field.atLeastOneOnWith);
    if (partner?.kind === "toggle" && partner.id !== field.id) return [];
    return [
      {
        blockId: field.id,
        message: `"Keep at least one on with" names "${field.atLeastOneOnWith}", which is not another toggle in this form`,
      },
    ];
  });
}
