import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";

export enum CanvasTargetKind {
  Page = "page",
  Element = "element",
  Group = "group",
}

/**
 * What the sidebar edits, by identity so a reorder can't redirect an edit. An
 * element is addressed by id, or by position only when the schema lets it go
 * without one (a legacy display block).
 */
export type CanvasTarget =
  | { kind: CanvasTargetKind.Page }
  | { kind: CanvasTargetKind.Element; id: string | null; index: number }
  | { kind: CanvasTargetKind.Group; key: string };

export type CanvasSelection = { pageId: string; target: CanvasTarget };

export type ResolvedTarget =
  | { kind: CanvasTargetKind.Page }
  | { kind: CanvasTargetKind.Element; index: number }
  | { kind: CanvasTargetKind.Group; key: string; start: number; end: number };

const PAGE: ResolvedTarget = { kind: CanvasTargetKind.Page };

export const elementTarget = (
  element: { id?: string },
  index: number,
): CanvasTarget => ({
  kind: CanvasTargetKind.Element,
  id: element.id || null,
  index,
});

/**
 * Where the selection sits on `page` now, or the page itself once the
 * selected element or group is gone or the selection belongs to another page.
 */
export function resolveTarget({
  page,
  groups,
  selection,
}: {
  page: Page;
  groups: VisibilityGroups;
  selection: CanvasSelection;
}): ResolvedTarget {
  if (selection.pageId !== page.id) return PAGE;
  const { target } = selection;
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return PAGE;
    case CanvasTargetKind.Element: {
      const isTarget = (element: PageItem | undefined) =>
        element !== undefined && (element.id || null) === target.id;
      // The stored position wins while it holds the id, so of elements
      // sharing an id the selected one stays selected.
      const index = isTarget(page.fields[target.index])
        ? target.index
        : target.id === null
          ? -1
          : page.fields.findIndex(isTarget);
      return index === -1 ? PAGE : { kind: CanvasTargetKind.Element, index };
    }
    case CanvasTargetKind.Group: {
      const segment = pageSegments(page.fields, groups).find(
        (candidate) =>
          candidate.kind === SegmentKind.Group && candidate.key === target.key,
      );
      return segment?.kind === SegmentKind.Group
        ? {
            kind: CanvasTargetKind.Group,
            key: segment.key,
            start: segment.start,
            end: segment.end,
          }
        : PAGE;
    }
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

/**
 * The target once the page's elements go from `before` to `after`. An
 * id-less block is addressed by position, so it follows its block to where
 * the change put it, or gives way to the page once its block is gone.
 */
export function followElement({
  before,
  after,
  target,
}: {
  before: readonly PageItem[];
  after: readonly PageItem[];
  target: CanvasTarget;
}): CanvasTarget {
  if (target.kind !== CanvasTargetKind.Element || target.id !== null) {
    return target;
  }
  const element = before[target.index];
  const index = element ? after.indexOf(element) : -1;
  return index === -1
    ? { kind: CanvasTargetKind.Page }
    : elementTarget(element!, index);
}

/** Identifies what the sidebar shows, changing when it shows something else. */
export function targetKey(page: Page, target: ResolvedTarget): string {
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return `page:${page.id}`;
    case CanvasTargetKind.Element:
      return `element:${page.id}/${page.fields[target.index]?.id || `@${target.index}`}`;
    case CanvasTargetKind.Group:
      return `group:${target.key}`;
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

/** How the builder names an element in a list of them. */
export const describeElement = (element: PageItem): string =>
  elementInternalDescriptor(element, {
    typeQualified: true,
    maxTextLength: 40,
  });
