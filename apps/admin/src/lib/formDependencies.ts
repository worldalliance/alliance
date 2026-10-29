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
/** The page, element, or list sub-field whose id is `id`, question or not. */
export function findPlace(
  pages: readonly Page[],
  id: string,
): FormPlace | null {
  for (const { place } of conditionHolders(pages)) {
    const page = pages[place.pageIndex];
    switch (place.kind) {
      case PlaceKind.Page:
        if (page?.id === id) return place;
        break;
      case PlaceKind.Element:
        if (page?.fields[place.index]?.id === id) return place;
        break;
      case PlaceKind.SubField: {
        const list = page?.fields[place.index];
        if (
          list &&
          "fields" in list &&
          list.fields?.[place.subIndex]?.id === id
        )
          return place;
        break;
      }
      default:
        throw new Error(`unknown place: ${place satisfies never}`);
    }
  }
  return null;
}

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

const within = (place: FormPlace, container: FormPlace): boolean => {
  if (place.pageIndex !== container.pageIndex) return false;
  switch (container.kind) {
    case PlaceKind.Page:
      return true;
    case PlaceKind.Element:
      return place.kind !== PlaceKind.Page && place.index === container.index;
    case PlaceKind.SubField:
      return (
        place.kind === PlaceKind.SubField &&
        place.index === container.index &&
        place.subIndex === container.subIndex
      );
    default:
      throw new Error(
        `unknown place: ${JSON.stringify(container satisfies never)}`,
      );
  }
};

/**
 * What outside `container` reads a question at or inside it, unless a
 * question outside carries the same id and still answers it.
 */
export function dependentsOutside(
  pages: readonly Page[],
  container: FormPlace,
): Dependent[] {
  const ids = new Set<string>();
  const kept = new Set<string>();
  for (const { place, question } of conditionHolders(pages)) {
    if (question) (within(place, container) ? ids : kept).add(question.id);
  }
  for (const id of kept) ids.delete(id);
  return dependentsOf(pages, ids).filter(
    ({ place }) => !within(place, container),
  );
}
