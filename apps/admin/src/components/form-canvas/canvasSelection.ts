import type {
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type {
  ListSubField,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
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

export enum ChildKind {
  SubField = "subField",
  Section = "section",
  SectionBlock = "sectionBlock",
}

/**
 * By id, or by position only when the schema lets the item go without one (a
 * legacy display block, an accordion section).
 */
type ItemAddress = { id: string | null; index: number };

export type ChildTarget =
  | { kind: ChildKind.SubField; field: ItemAddress }
  | { kind: ChildKind.Section; section: ItemAddress }
  | { kind: ChildKind.SectionBlock; section: ItemAddress; block: ItemAddress };

/**
 * What the sidebar edits, by identity so a reorder can't redirect an edit: a
 * page, a group, an element, or a `child` inside an element.
 */
export type CanvasTarget =
  | { kind: CanvasTargetKind.Page }
  | ({ kind: CanvasTargetKind.Element; child?: ChildTarget } & ItemAddress)
  | { kind: CanvasTargetKind.Group; key: string };

export type CanvasSelection = { pageId: string; target: CanvasTarget };

export type ResolvedChild =
  | { kind: ChildKind.SubField; index: number }
  | { kind: ChildKind.Section; section: number }
  | { kind: ChildKind.SectionBlock; section: number; block: number };

export type ResolvedTarget =
  | { kind: CanvasTargetKind.Page }
  | { kind: CanvasTargetKind.Element; index: number; child?: ResolvedChild }
  | { kind: CanvasTargetKind.Group; key: string; start: number; end: number };

const PAGE: ResolvedTarget = { kind: CanvasTargetKind.Page };

export const addressOf = (
  item: { id?: string },
  index: number,
): ItemAddress => ({
  id: item.id || null,
  index,
});

type ElementTarget = Extract<CanvasTarget, { kind: CanvasTargetKind.Element }>;

export const elementTarget = (
  element: { id?: string },
  index: number,
): ElementTarget => ({
  kind: CanvasTargetKind.Element,
  ...addressOf(element, index),
});

export const subFieldChild = (
  field: ListSubField,
  index: number,
): ChildTarget => ({
  kind: ChildKind.SubField,
  field: addressOf(field, index),
});

export const sectionChild = (
  section: AccordionSection,
  index: number,
): ChildTarget => ({
  kind: ChildKind.Section,
  section: addressOf(section, index),
});

export const sectionBlockChild = ({
  section,
  sectionIndex,
  block,
  blockIndex,
}: {
  section: AccordionSection;
  sectionIndex: number;
  block: NestedDisplayBlock;
  blockIndex: number;
}): ChildTarget => ({
  kind: ChildKind.SectionBlock,
  section: addressOf(section, sectionIndex),
  block: addressOf(block, blockIndex),
});

/**
 * Where `address` sits in `items`, or -1. The stored position wins while it
 * holds the id, so of items sharing an id the selected one stays selected.
 */
export function findAddressed(
  items: readonly { id?: string }[],
  { id, index }: ItemAddress,
): number {
  const isTarget = (item: { id?: string } | undefined) =>
    item !== undefined && (item.id || null) === id;
  if (isTarget(items[index])) return index;
  return id === null ? -1 : items.findIndex(isTarget);
}

/** Where `child` sits in `element` now, or its nearest enclosing item still there. */
function resolveChild(
  element: PageItem,
  child: ChildTarget,
): ResolvedChild | undefined {
  switch (child.kind) {
    case ChildKind.SubField: {
      if (element.kind !== "list") return undefined;
      const index = findAddressed(element.fields, child.field);
      return index === -1 ? undefined : { kind: ChildKind.SubField, index };
    }
    case ChildKind.Section:
    case ChildKind.SectionBlock: {
      if (element.kind !== "accordion") return undefined;
      const section = findAddressed(element.sections, child.section);
      if (section === -1) return undefined;
      const block =
        child.kind === ChildKind.SectionBlock
          ? findAddressed(element.sections[section]!.blocks, child.block)
          : -1;
      return block === -1
        ? { kind: ChildKind.Section, section }
        : { kind: ChildKind.SectionBlock, section, block };
    }
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
}

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
      const index = findAddressed(page.fields, target);
      if (index === -1) return PAGE;
      const child =
        target.child && resolveChild(page.fields[index]!, target.child);
      return child
        ? { kind: CanvasTargetKind.Element, index, child }
        : { kind: CanvasTargetKind.Element, index };
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
  return index === -1 ? { kind: CanvasTargetKind.Page } : { ...target, index };
}

const byPosition = (child: ChildTarget): boolean => {
  switch (child.kind) {
    case ChildKind.SubField:
      return child.field.id === null;
    case ChildKind.Section:
      return child.section.id === null;
    case ChildKind.SectionBlock:
      return child.section.id === null || child.block.id === null;
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
};

/**
 * The target without what it addresses by position, for a schema from
 * elsewhere (undo, pasted JSON, a conflict) that can shift what sits there:
 * the page in place of an id-less element, the element in place of a child.
 */
export function forgetPositions(target: CanvasTarget): CanvasTarget {
  if (target.kind !== CanvasTargetKind.Element) return target;
  if (target.id === null) return { kind: CanvasTargetKind.Page };
  if (!target.child || !byPosition(target.child)) return target;
  const { child: _forgotten, ...element } = target;
  return element;
}

export const keyPart = (item: { id?: string } | undefined, index: number) =>
  item?.id || `@${index}`;

function childKey(element: PageItem | undefined, child: ResolvedChild) {
  switch (child.kind) {
    case ChildKind.SubField:
      return `/field:${keyPart(element?.kind === "list" ? element.fields[child.index] : undefined, child.index)}`;
    case ChildKind.Section:
    case ChildKind.SectionBlock: {
      const section =
        element?.kind === "accordion"
          ? element.sections[child.section]
          : undefined;
      const sectionKey = `/section:${keyPart(section, child.section)}`;
      return child.kind === ChildKind.Section
        ? sectionKey
        : `${sectionKey}/block:${keyPart(section?.blocks[child.block], child.block)}`;
    }
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
}

/** Identifies what the sidebar shows, changing when it shows something else. */
export function targetKey(page: Page, target: ResolvedTarget): string {
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return `page:${page.id}`;
    case CanvasTargetKind.Element: {
      const element = page.fields[target.index];
      const key = `element:${page.id}/${keyPart(element, target.index)}`;
      return target.child ? key + childKey(element, target.child) : key;
    }
    case CanvasTargetKind.Group:
      return `group:${target.key}`;
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

export const sectionTitle = (section: AccordionSection): string =>
  section.title || "Untitled section";

export const describeSection = (section: AccordionSection): string =>
  `Section: ${sectionTitle(section)}`;

/** How the sidebar names the element or child it shows. */
export const describeHeading = (item: PageItem): string =>
  elementInternalDescriptor(item, { typeQualified: true, maxTextLength: 60 });

/** How the builder names an element in a list of them. */
export const describeElement = (element: PageItem): string =>
  elementInternalDescriptor(element, {
    typeQualified: true,
    maxTextLength: 40,
  });
