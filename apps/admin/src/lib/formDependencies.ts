import {
  conditionHolders,
  PlaceKind,
  type ConditionHolder,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import { type Page } from "@alliance/common/forms/form-schema";
import { conditionFieldReference } from "@alliance/common/forms/visible-if-formula";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "./visibilityGroups";

export enum DependencyRole {
  Visibility = "visibility",
  Required = "required",
}

/** A question a formula reads; `place` is null for one this form lacks. */
export type Source =
  | {
      sourceFormId: null;
      fieldId: string;
      place: FormPlace | null;
      roles: DependencyRole[];
    }
  | {
      sourceFormId: number;
      fieldId: string;
      roles: DependencyRole[];
    };

export type Dependent = { place: FormPlace; roles: DependencyRole[] };

export enum DependentEntryKind {
  Single = "single",
  Group = "group",
}

export type DependentEntry =
  | { kind: DependentEntryKind.Single; dependent: Dependent }
  | {
      kind: DependentEntryKind.Group;
      pageIndex: number;
      key: string;
      members: Dependent[];
    };

type Governed = ConditionHolder["formulas"];

/**
 * Where the question with `fieldId` sits, top-level or in a list. Of
 * duplicates, the last wins, as in `collectFieldLookup`, so a link reaches the
 * question the condition editor names.
 */
export function findQuestion(
  pages: readonly Page[],
  fieldId: string,
): FormPlace | null {
  let found: FormPlace | null = null;
  for (const { place, question } of conditionHolders(pages)) {
    if (question?.id === fieldId) found = place;
  }
  return found;
}

const ROLE_FORMULA: Record<DependencyRole, keyof Governed> = {
  [DependencyRole.Visibility]: "visibleIfFormula",
  [DependencyRole.Required]: "requiredIfFormula",
};

function referencesOf(item: Governed, role: DependencyRole) {
  return Object.values(item[ROLE_FORMULA[role]]?.conditions ?? {}).flatMap(
    (condition) => conditionFieldReference(condition) ?? [],
  );
}

/** The questions `item`'s visibility and required-if formulas read, each once. */
export function sourcesOf(pages: readonly Page[], item: Governed): Source[] {
  const sources = new Map<string, Source>();
  for (const role of Object.values(DependencyRole)) {
    for (const { fieldId, sourceFormId } of referencesOf(item, role)) {
      const key = JSON.stringify([sourceFormId, fieldId]);
      const existing = sources.get(key);
      if (existing) {
        if (!existing.roles.includes(role)) existing.roles.push(role);
      } else {
        sources.set(
          key,
          sourceFormId === null
            ? {
                sourceFormId,
                fieldId,
                place: findQuestion(pages, fieldId),
                roles: [role],
              }
            : { sourceFormId, fieldId, roles: [role] },
        );
      }
    }
  }
  return [...sources.values()];
}

/** What reads any of `fieldIds` on this form, in form order. */
export function dependentsOf(
  pages: readonly Page[],
  fieldIds: ReadonlySet<string>,
): Dependent[] {
  const dependents: Dependent[] = [];
  for (const { place, formulas } of conditionHolders(pages)) {
    const roles = Object.values(DependencyRole).filter((role) =>
      referencesOf(formulas, role).some(
        ({ fieldId, sourceFormId }) =>
          sourceFormId === null && fieldIds.has(fieldId),
      ),
    );
    if (roles.length > 0) dependents.push({ place, roles });
  }
  return dependents;
}

/**
 * The dependents, with the members of a visibility group whose shared formula
 * reads the question gathered into one entry for the group.
 */
export function groupDependents({
  pages,
  groups,
  dependents,
}: {
  pages: readonly Page[];
  groups: VisibilityGroups;
  dependents: readonly Dependent[];
}): DependentEntry[] {
  const entries: DependentEntry[] = [];
  const groupEntries = new Map<string, DependentEntry>();
  for (const dependent of dependents) {
    const { place } = dependent;
    const segment =
      place.kind === PlaceKind.Element &&
      dependent.roles.includes(DependencyRole.Visibility)
        ? pageSegments(pages[place.pageIndex]?.fields ?? [], groups).find(
            (candidate) =>
              candidate.kind === SegmentKind.Group &&
              candidate.start <= place.index &&
              place.index < candidate.end,
          )
        : undefined;
    if (segment?.kind !== SegmentKind.Group) {
      entries.push({ kind: DependentEntryKind.Single, dependent });
      continue;
    }
    const existing = groupEntries.get(segment.key);
    if (existing?.kind === DependentEntryKind.Group) {
      existing.members.push(dependent);
      continue;
    }
    const entry: DependentEntry = {
      kind: DependentEntryKind.Group,
      pageIndex: place.pageIndex,
      key: segment.key,
      members: [dependent],
    };
    groupEntries.set(segment.key, entry);
    entries.push(entry);
  }
  return entries;
}
