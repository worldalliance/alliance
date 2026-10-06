import type { FormSchema } from "@alliance/common/forms/form-schema";
import { isEqual } from "es-toolkit";
import { useMemo } from "react";
import type { CustomValidatorDraft } from "../components/form-fields/customValidatorDrafts";
import { mapCustomValidatorIds } from "./customValidatorIds";
import { useDraftHistory } from "./useDraftHistory";
import {
  deriveVisibilityGroups,
  normalizeVisibilityGroups,
  type VisibilityGroups,
} from "./visibilityGroups";

/** Everything an undo restores. */
export type FormDraft = {
  schema: FormSchema;
  groups: VisibilityGroups;
  validatorDrafts: Readonly<Record<number, CustomValidatorDraft>>;
};

export const startFormDraft = (schema: FormSchema): FormDraft => ({
  schema,
  groups: deriveVisibilityGroups(schema.pages),
  validatorDrafts: {},
});

const withSchema = (
  draft: FormDraft,
  { schema, groups }: { schema: FormSchema; groups?: VisibilityGroups },
): FormDraft => ({
  ...draft,
  schema,
  groups: normalizeVisibilityGroups(schema.pages, groups ?? draft.groups),
});

export type CreatedValidator = { id: number; draft: CustomValidatorDraft };

/**
 * Points a draft at the validators Save created, wherever it still holds the
 * draft that was created. A draft edited since keeps its temporary id, so
 * restoring it creates the validator it describes.
 */
export function resolveValidatorDrafts(
  draft: FormDraft,
  created: ReadonlyMap<number, CreatedValidator>,
): FormDraft {
  const resolved = new Map<number, number>();
  const validatorDrafts = { ...draft.validatorDrafts };
  for (const [draftId, validator] of created) {
    const held = draft.validatorDrafts[draftId];
    if (held && isEqual(held, validator.draft)) {
      resolved.set(draftId, validator.id);
      delete validatorDrafts[draftId];
    }
  }
  if (resolved.size === 0) return draft;
  return {
    ...draft,
    schema: mapCustomValidatorIds(draft.schema, (id) => resolved.get(id) ?? id),
    validatorDrafts,
  };
}

export function useFormDraft(initialSchema: () => FormSchema) {
  const history = useDraftHistory(() => startFormDraft(initialSchema()));
  const { commit, amend, reset, mapAll } = history;

  const actions = useMemo(
    () => ({
      /** Keeps the current groups, or `groups`, wherever `schema` still allows. */
      setSchema: (schema: FormSchema, groups?: VisibilityGroups) =>
        commit((draft) => withSchema(draft, { schema, groups })),
      /** Replaces the schema, regrouping it from its conditions. */
      regroupSchema: (schema: FormSchema) =>
        commit((draft) =>
          withSchema(draft, {
            schema,
            groups: deriveVisibilityGroups(schema.pages),
          }),
        ),
      /** Rewrites the current step's schema without adding a step. */
      amendSchema: (schema: FormSchema) =>
        amend((draft) =>
          draft.schema === schema ? draft : withSchema(draft, { schema }),
        ),
      /** Starts a new history from `schema`. */
      loadSchema: (schema: FormSchema) => reset(startFormDraft(schema)),
      setGroups: (groups: VisibilityGroups) =>
        commit((draft) => withSchema(draft, { schema: draft.schema, groups })),
      setValidatorDraft: (draftId: number, validator: CustomValidatorDraft) =>
        commit((draft) => ({
          ...draft,
          validatorDrafts: { ...draft.validatorDrafts, [draftId]: validator },
        })),
      removeValidatorDraft: (draftId: number) =>
        commit((draft) => {
          if (!(draftId in draft.validatorDrafts)) return draft;
          const { [draftId]: _removed, ...validatorDrafts } =
            draft.validatorDrafts;
          return { ...draft, validatorDrafts };
        }),
      /** Rewrites every step to the validators Save created. */
      resolveValidatorDrafts: (
        created: ReadonlyMap<number, CreatedValidator>,
      ) => mapAll((draft) => resolveValidatorDrafts(draft, created)),
    }),
    [amend, commit, mapAll, reset],
  );

  return {
    ...actions,
    ...history.draft,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    withoutStep: history.withoutStep,
    endStep: history.endStep,
  };
}
