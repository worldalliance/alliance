import type { AccordionBlock } from "@alliance/common/forms/display-blocks";
import type { ListField } from "@alliance/common/forms/form-schema";
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
import { SidebarSection } from "./sidebarSections";

type ContainerProps = {
  selectedChild: ResolvedChild | undefined;
  onSelectChild: (child: ChildTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
};

function CanvasChild({
  label,
  selected,
  onSelect,
  interactive,
  conditionSummary,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: (section: SidebarSection) => void;
  interactive: boolean;
  conditionSummary?: string;
  children: ReactNode;
}) {
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
        className={SELECT_OVERLAY}
      />
      <CanvasContent interactive={interactive}>{children}</CanvasContent>
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
}: ContainerProps & { list: ListField }) {
  const { minCards, maxCards } = listCardLimits(list);
  const hiddenInOutput = new Set(list.outputViewHiddenFieldIds ?? []);
  return (
    <div className="relative space-y-3">
      <CanvasContent interactive={false}>
        <RenderLabel field={list} />
      </CanvasContent>
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
        {list.fields.map((sub, index) => (
          <CanvasChild
            key={sub.id || index}
            label={describeElement(sub)}
            selected={
              selectedChild?.kind === ChildKind.SubField &&
              selectedChild.index === index
            }
            onSelect={(section) =>
              onSelectChild(subFieldChild(sub, index), section)
            }
            interactive={false}
            conditionSummary={
              subFieldEditsConditions(sub) && sub.visibleIfFormula
                ? summarize(sub.visibleIfFormula)
                : undefined
            }
          >
            <CanvasQuestion field={sub} />
            {hiddenInOutput.has(sub.id) && <ListHiddenNote />}
          </CanvasChild>
        ))}
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
}: Omit<ContainerProps, "summarize"> & { block: AccordionBlock }) {
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

  return (
    <div className={cn("relative", ACCORDION_SECTIONS)}>
      {block.sections.map((section, index) => {
        const key = keyPart(section, index);
        const isOpen = open.has(key);
        const label = describeSection(section);
        const sectionSelected =
          selectedChild?.kind === ChildKind.Section &&
          selectedChild.section === index;
        return (
          <div key={key}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-md",
                selectionRing(sectionSelected),
              )}
            >
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
                {section.blocks.map((nested, nestedIndex) => (
                  <CanvasChild
                    key={nested.id || nestedIndex}
                    label={describeElement(nested)}
                    selected={
                      selectedChild?.kind === ChildKind.SectionBlock &&
                      selectedChild.section === index &&
                      selectedChild.block === nestedIndex
                    }
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
                  >
                    <RenderDisplayBlock block={nested} />
                  </CanvasChild>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
