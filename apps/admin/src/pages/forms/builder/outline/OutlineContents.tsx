import type { PageItem } from "@alliance/common/forms/form-schema";
import { Rows3 } from "lucide-react";
import {
  elementIcon,
  elementText,
} from "./elementIcons";
import {
  ChildKind,
  describeElement,
  describeSection,
  sectionBlockChild,
  sectionChild,
  sectionTitle,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "../selection/canvasSelection";
import type { OutlineEntry } from "./OutlineRow";

const HOLDS_CHILDREN = {
  text: false,
  textarea: false,
  email: false,
  phone: false,
  number: false,
  range: false,
  checkbox: false,
  radio: false,
  select: false,
  multiselect: false,
  ranking: false,
  date: false,
  time: false,
  timezone: false,
  city: false,
  file: false,
  contract: false,
  list: true,
  custom: false,
  image: false,
  toggle: false,
  timePicker: false,
  header: false,
  label: false,
  conversation: false,
  divider: false,
  spacer: false,
  html: false,
  images: false,
  video: false,
  quote: false,
  biglink: false,
  copytext: false,
  previousAnswer: false,
  userLocation: false,
  chatTranscript: false,
  expertMessage: false,
  accordion: true,
} as const satisfies Record<PageItem["kind"], boolean>;

type ContainerKind = {
  [K in keyof typeof HOLDS_CHILDREN]: (typeof HOLDS_CHILDREN)[K] extends true
    ? K
    : never;
}[keyof typeof HOLDS_CHILDREN];

export type Container = Extract<PageItem, { kind: ContainerKind }>;

export const isContainer = (element: PageItem): element is Container =>
  HOLDS_CHILDREN[element.kind];

export const leafRow = (item: PageItem) => ({
  label: describeElement(item),
  text: elementText(item),
  icon: elementIcon(item),
});

/**
 * A list's sub-fields, or an accordion's sections and their blocks, as rows
 * under the container's. A section starts collapsed and opens only by its
 * chevron or the arrow keys.
 */
export function containerEntries({
  element,
  entryKey,
  level,
  child,
  selectChild,
  isExpanded,
  toggle,
}: {
  element: Container;
  /** The container's own entry key, which its children's keys extend. */
  entryKey: string;
  level: number;
  /** The selected child, when the selection is inside `element`. */
  child: ResolvedChild | undefined;
  selectChild: (child: ChildTarget) => void;
  isExpanded: (key: string, byDefault: boolean) => boolean;
  toggle: (key: string, byDefault: boolean) => void;
}): OutlineEntry[] {
  switch (element.kind) {
    case "list":
      return element.fields.map((sub, at) => ({
        key: `${entryKey}/field:${sub.id || at}`,
        row: {
          ...leafRow(sub),
          level,
          current: child?.kind === ChildKind.SubField && child.index === at,
          onSelect: () => selectChild(subFieldChild(sub, at)),
        },
        children: [],
      }));
    case "accordion":
      return element.sections.map((section, at) => {
        const key = `${entryKey}/section:${section.id || at}`;
        const open = isExpanded(key, false);
        const inside =
          child?.kind === ChildKind.SectionBlock && child.section === at;
        return {
          key,
          row: {
            label: describeSection(section),
            text: sectionTitle(section),
            icon: Rows3,
            level,
            current:
              (child?.kind === ChildKind.Section && child.section === at) ||
              (inside && !open),
            selected: child?.kind === ChildKind.Section && child.section === at,
            onSelect: () => selectChild(sectionChild(section, at)),
            ...(section.blocks.length > 0 && {
              expanded: open,
              onToggle: () => toggle(key, false),
            }),
            containsSelection: inside && !open,
          },
          children: open
            ? section.blocks.map((block, blockAt) => ({
                key: `${key}/block:${block.id || blockAt}`,
                row: {
                  ...leafRow(block),
                  level: level + 1,
                  current: inside && child.block === blockAt,
                  onSelect: () =>
                    selectChild(
                      sectionBlockChild({
                        section,
                        sectionIndex: at,
                        block,
                        blockIndex: blockAt,
                      }),
                    ),
                },
                children: [],
              }))
            : [],
        };
      });
    default:
      throw new Error(
        `unknown container: ${JSON.stringify(element satisfies never)}`,
      );
  }
}
