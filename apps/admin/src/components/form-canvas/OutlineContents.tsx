import type { PageItem } from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import {
  ChildKind,
  describeElement,
  describeSection,
  sectionBlockChild,
  sectionChild,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "./canvasSelection";
import { OutlineRow } from "./OutlineRow";

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
  header: false,
  label: false,
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

/** A list's sub-fields, or an accordion's sections and their blocks. */
export function OutlineContents({
  element,
  child,
  selectChild,
  sectionKey,
  isExpanded,
  toggle,
}: {
  element: Container;
  child: ResolvedChild | undefined;
  selectChild: (child: ChildTarget) => void;
  sectionKey: (section: number) => string;
  isExpanded: (key: string, byDefault: boolean) => boolean;
  toggle: (key: string, byDefault: boolean) => void;
}) {
  switch (element.kind) {
    case "list":
      return (
        <NestedEntries empty="No fields">
          {element.fields.map((sub, at) => (
            <li key={sub.id || at}>
              <OutlineRow
                label={describeElement(sub)}
                current={
                  child?.kind === ChildKind.SubField && child.index === at
                }
                onSelect={() => selectChild(subFieldChild(sub, at))}
              />
            </li>
          ))}
        </NestedEntries>
      );
    case "accordion":
      return (
        <NestedEntries empty="No sections">
          {element.sections.map((section, at) => {
            const entryKey = sectionKey(at);
            const open = isExpanded(entryKey, false);
            return (
              <li key={entryKey}>
                <OutlineRow
                  label={describeSection(section)}
                  current={
                    (child?.kind === ChildKind.Section ||
                      (child?.kind === ChildKind.SectionBlock && !open)) &&
                    child.section === at
                  }
                  onSelect={() => selectChild(sectionChild(section, at))}
                  expanded={open}
                  onToggle={() => toggle(entryKey, false)}
                />
                {open && (
                  <NestedEntries empty="No blocks">
                    {section.blocks.map((block, blockAt) => (
                      <li key={block.id || blockAt}>
                        <OutlineRow
                          label={describeElement(block)}
                          current={
                            child?.kind === ChildKind.SectionBlock &&
                            child.section === at &&
                            child.block === blockAt
                          }
                          onSelect={() =>
                            selectChild(
                              sectionBlockChild({
                                section,
                                sectionIndex: at,
                                block,
                                blockIndex: blockAt,
                              }),
                            )
                          }
                        />
                      </li>
                    ))}
                  </NestedEntries>
                )}
              </li>
            );
          })}
        </NestedEntries>
      );
    default:
      throw new Error(
        `unknown container: ${JSON.stringify(element satisfies never)}`,
      );
  }
}

function NestedEntries({
  empty,
  children,
}: {
  empty: string;
  children: ReactNode[];
}) {
  return (
    <ul className="ml-3 pl-1">
      {children.length === 0 ? (
        <li className="px-2 py-1 text-xs text-gray-400">{empty}</li>
      ) : (
        children
      )}
    </ul>
  );
}
