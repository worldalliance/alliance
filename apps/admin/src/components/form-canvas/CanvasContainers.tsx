import type { AccordionBlock } from "@alliance/common/forms/display-blocks";
import type { ListField, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { listCardLimits } from "@alliance/shared/forms/listCards";
import { cn } from "@alliance/shared/styles/util";
import {
  ACCORDION_CONTENTS,
  ACCORDION_SECTIONS,
  ACCORDION_TITLE,
  AccordionChevron,
} from "@alliance/sharedweb/forms/accordionStyles";
import {
  ListAddButton,
  ListCard,
  ListHiddenNote,
  ListRemoveButton,
} from "@alliance/sharedweb/forms/ListCard";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { RenderLabel } from "@alliance/sharedweb/forms/RenderField";
import { useState, type ReactNode } from "react";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { updateListSubField } from "../../lib/updateListSubField";
import { accordionWrites } from "./accordionWrites";
import {
  CanvasContent,
  CanvasQuestion,
  ignoreAnswer,
  INTERACTIVE_ON_CANVAS,
  SELECT_OVERLAY,
  selectionRing,
} from "./CanvasContent";
import {
  ChildKind,
  describeElement,
  describeSection,
  keyPart,
  sectionBlockChild,
  sectionChild,
  sectionTitle,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "./canvasSelection";
import { subFieldEditsConditions } from "./ChildSettings";
import { ElementConditionsIndicator } from "./ConditionsIndicator";
import {
  EditTextButton,
  InlineTextEditor,
  inlineTextFor,
  ITEM_PENCIL,
  startOnEnter,
  TextLines,
  type InlineEditing,
  type InlineText,
} from "./InlineText";
import { SidebarSection } from "./sidebarSections";

type ContainerProps = {
  selectedChild: ResolvedChild | undefined;
  onSelectChild: (child: ChildTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
  onUpdate: (updates: Partial<PageItem>) => void;
  inline: InlineEditing | null;
};

function CanvasChild({
  label,
  selected,
  onSelect,
  interactive,
  conditionSummary,
  inline,
  text,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: (section: SidebarSection) => void;
  interactive: boolean;
  conditionSummary?: string;
  /** Null unless the child is selected. */
  inline: InlineEditing | null;
  text: InlineText | null;
  children: ReactNode;
}) {
  const editing = text ? inline : null;
  return (
    <div
      className={cn(
        "relative -mx-2 rounded-md px-2 py-1",
        selectionRing(selected),
      )}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(SidebarSection.Content);
      }}
    >
      <button
        type="button"
        aria-label={`Select ${label}`}
        aria-pressed={selected}
        onKeyDown={editing ? startOnEnter(editing) : undefined}
        className={SELECT_OVERLAY}
      />
      {editing?.editing && text ? (
        text.editor
      ) : (
        <CanvasContent interactive={interactive}>{children}</CanvasContent>
      )}
      {editing && !editing.editing && text && (
        <EditTextButton
          label={text.editLabel}
          onClick={editing.start}
          className={ITEM_PENCIL}
        />
      )}
      {conditionSummary && (
        <ElementConditionsIndicator
          summary={conditionSummary}
          onOpen={() => onSelect(SidebarSection.Conditions)}
        />
      )}
    </div>
  );
}

const EXAMPLE_CARDS = 1;

/** A list as one example card, whose sub-fields select on their own. */
export function CanvasList({
  list,
  selectedChild,
  onSelectChild,
  summarize,
  onUpdate,
  inline,
  labelEditor,
}: ContainerProps & {
  list: ListField;
  /** The list's label, open in place of its rendering. */
  labelEditor: ReactNode;
}) {
  const { minCards, maxCards } = listCardLimits(list);
  const hiddenInOutput = new Set(list.outputViewHiddenFieldIds ?? []);
  return (
    <div className="relative space-y-3">
      {labelEditor ?? (
        <CanvasContent interactive={false}>
          <RenderLabel field={list} />
        </CanvasContent>
      )}
      <ListCard
        remove={
          <CanvasContent interactive={false}>
            <ListRemoveButton
              onClick={ignoreAnswer}
              disabled={EXAMPLE_CARDS <= minCards}
            />
          </CanvasContent>
        }
      >
        {list.fields.length === 0 && (
          <p className="text-sm text-gray-500">No fields in each card yet.</p>
        )}
        {list.fields.map((sub, index) => {
          const selected =
            selectedChild?.kind === ChildKind.SubField &&
            selectedChild.index === index;
          const childInline = selected ? inline : null;
          return (
            <CanvasChild
              key={sub.id || index}
              label={describeElement(sub)}
              selected={selected}
              onSelect={(section) =>
                onSelectChild(subFieldChild(sub, index), section)
              }
              interactive={false}
              conditionSummary={
                subFieldEditsConditions(sub) && sub.visibleIfFormula
                  ? summarize(sub.visibleIfFormula)
                  : undefined
              }
              inline={childInline}
              text={
                childInline &&
                inlineTextFor({
                  item: sub,
                  onChange: (label) =>
                    onUpdate({
                      fields: updateListSubField(list.fields, index, { label }),
                    }),
                  onStop: childInline.stop,
                })
              }
            >
              <CanvasQuestion field={sub} />
              {hiddenInOutput.has(sub.id) && <ListHiddenNote />}
            </CanvasChild>
          );
        })}
      </ListCard>
      {EXAMPLE_CARDS < maxCards && (
        <CanvasContent interactive={false}>
          <ListAddButton listField={list} onClick={ignoreAnswer} />
        </CanvasContent>
      )}
    </div>
  );
}

/**
 * An accordion whose section titles and blocks select on their own. Sections
 * expand from their toggle, and to show a selection inside them.
 */
export function CanvasAccordion({
  block,
  selectedChild,
  onSelectChild,
  onUpdate,
  updateCurrent,
  inline,
}: Omit<ContainerProps, "summarize"> & {
  block: AccordionBlock;
  updateCurrent: AddressedWrite | undefined;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const setSectionOpen = ({ key, isOpen }: { key: string; isOpen: boolean }) =>
    setOpen((current) => {
      if (block.singleOpen) return new Set(isOpen ? [key] : []);
      const next = new Set(current);
      if (isOpen) next.add(key);
      else next.delete(key);
      return next;
    });

  const selectedIn =
    selectedChild?.kind === ChildKind.Section ||
    selectedChild?.kind === ChildKind.SectionBlock
      ? selectedChild
      : undefined;
  const selectedSection =
    selectedIn && block.sections[selectedIn.section]
      ? keyPart(block.sections[selectedIn.section], selectedIn.section)
      : null;
  const selectionKey =
    selectedIn?.kind === ChildKind.SectionBlock
      ? `${selectedSection}/${selectedIn.block}`
      : selectedSection;
  const [revealed, setRevealed] = useState<string | null>(null);
  if (revealed !== selectionKey) {
    setRevealed(selectionKey);
    if (selectedSection !== null && !open.has(selectedSection)) {
      setSectionOpen({ key: selectedSection, isOpen: true });
    }
  }

  if (block.sections.length === 0) {
    return (
      <CanvasContent interactive={false}>
        <p className="text-sm text-gray-500">This accordion has no sections.</p>
      </CanvasContent>
    );
  }

  const { updateSection, blockWrite } = accordionWrites({
    sections: block.sections,
    onUpdate,
    updateCurrent,
  });

  return (
    <div className={cn("relative", ACCORDION_SECTIONS)}>
      {block.sections.map((section, index) => {
        const key = keyPart(section, index);
        const isOpen = open.has(key);
        const label = describeSection(section);
        const sectionSelected =
          selectedChild?.kind === ChildKind.Section &&
          selectedChild.section === index;
        const titleInline = sectionSelected ? inline : null;
        return (
          <div key={key}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-md",
                selectionRing(sectionSelected),
              )}
            >
              {titleInline?.editing ? (
                <div className="min-w-0 flex-1 py-2">
                  <InlineTextEditor
                    value={section.title}
                    onChange={(title) =>
                      updateSection(index, () => ({ title }))
                    }
                    lines={TextLines.Single}
                    label="Section title"
                    onStop={titleInline.stop}
                    className={ACCORDION_TITLE}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Select ${label}`}
                  aria-pressed={sectionSelected}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectChild(
                      sectionChild(section, index),
                      SidebarSection.Content,
                    );
                  }}
                  onKeyDown={
                    titleInline ? startOnEnter(titleInline) : undefined
                  }
                  className="min-w-0 flex-1 rounded-md py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span
                    className={cn(
                      ACCORDION_TITLE,
                      !section.title && "text-gray-400",
                    )}
                  >
                    {sectionTitle(section)}
                  </span>
                </button>
              )}
              {titleInline && !titleInline.editing && (
                <EditTextButton
                  label="Edit section title"
                  onClick={titleInline.start}
                  className="shrink-0"
                />
              )}
              <button
                type="button"
                aria-label={`Contents of ${label}`}
                aria-expanded={isOpen}
                title={isOpen ? "Collapse" : "Expand"}
                onClick={(event) => {
                  event.stopPropagation();
                  setSectionOpen({ key, isOpen: !isOpen });
                }}
                className="group shrink-0 rounded p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <AccordionChevron
                  className={cn(
                    "group-hover:text-zinc-800",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
            {isOpen && (
              <div className={ACCORDION_CONTENTS}>
                {section.blocks.length === 0 && (
                  <p className="text-sm text-gray-500">
                    This section is empty.
                  </p>
                )}
                {section.blocks.map((nested, nestedIndex) => {
                  const selected =
                    selectedChild?.kind === ChildKind.SectionBlock &&
                    selectedChild.section === index &&
                    selectedChild.block === nestedIndex;
                  const childInline = selected ? inline : null;
                  return (
                    <CanvasChild
                      key={nested.id || nestedIndex}
                      label={describeElement(nested)}
                      selected={selected}
                      onSelect={(sidebarSection) =>
                        onSelectChild(
                          sectionBlockChild({
                            section,
                            sectionIndex: index,
                            block: nested,
                            blockIndex: nestedIndex,
                          }),
                          sidebarSection,
                        )
                      }
                      interactive={INTERACTIVE_ON_CANVAS[nested.kind]}
                      inline={childInline}
                      text={
                        childInline &&
                        inlineTextFor({
                          item: nested,
                          onChange: (text) =>
                            blockWrite({
                              sectionIndex: index,
                              blockIndex: nestedIndex,
                            })(() => ({ text })),
                          onStop: childInline.stop,
                        })
                      }
                    >
                      <RenderDisplayBlock block={nested} />
                    </CanvasChild>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
