import type { AccordionSection } from "@alliance/common/forms/display-blocks";
import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type {
  ListSubField,
  PageItem,
} from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import type { AddressedWrite } from "../../../../lib/displayBlockById";
import { updateListSubField } from "../../../../lib/updateListSubField";
import { ReadOnlyId } from "../kit/ReadOnlyId";
import { controlClass } from "../../../../ui/styles";
import { EditableNestedBlock } from "../blocks/EditableNestedBlock";
import { PerViewerOptions } from "../blocks/PerViewerOptionsContext";
import { ElementExpressionScope } from "../conditions/expressionBuffers";
import { SUB_FIELD_EDITORS } from "../questions/subFieldEditors";
import type {
  BaseFieldProps,
  FieldEditor,
  FieldOfKind,
} from "../questions/types";
import { cn } from "../../../../ui/cn";
import { VariableTextField } from "../questions/VariableTextField";
import { accordionWrites } from "../selection/accordionWrites";
import {
  ChildKind,
  describeElement,
  describeHeading,
  describeSection,
  sectionBlockChild,
  sectionChild,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "../selection/canvasSelection";
import { neighborMoves } from "./ChildRows";
import { ElementBoundary, FlaggedSettings } from "../canvas/ElementBoundary";
import { SettingsSidebar } from "./SettingsSidebar";
import {
  ALL_SECTIONS,
  SectionPanels,
  SidebarSection,
  UNCONDITIONAL_SECTIONS,
} from "./sidebarSections";
import { DELETION } from "./useGuardedDeletion";

type ListSubFieldKind = ListSubField["kind"];

const LIST_SUB_FIELD_EDITORS: {
  [K in ListSubFieldKind]: FieldEditor<K> | null;
} = { ...SUB_FIELD_EDITORS, contract: null, custom: null };

export const subFieldEditsConditions = (sub: ListSubField) =>
  LIST_SUB_FIELD_EDITORS[sub.kind] !== null;

function renderSubFieldEditor<K extends ListSubFieldKind>(
  kind: K,
  props: BaseFieldProps<FieldOfKind[K]>,
) {
  const Editor: FieldEditor<K> | null = LIST_SUB_FIELD_EDITORS[kind];
  return Editor ? (
    <Editor {...props} />
  ) : (
    <SectionPanels
      content={
        <p className="text-fg-muted">
          No settings to edit for this kind of question.
        </p>
      }
    />
  );
}

type ChildView = {
  heading: string;
  sections: readonly SidebarSection[];
  moves: ReturnType<typeof neighborMoves>;
  idLabel: string;
  id: string | undefined;
  deleteLabel: string;
  remove: () => void;
  /** Where a delete lands; null to land on the element. */
  parent: ChildTarget | null;
  editor: ReactNode;
};

/**
 * The settings of something inside `element`: a list's sub-field, or an
 * accordion's section or one of its blocks. Edits write the element.
 */
export function ChildSettings({
  element,
  child,
  onUpdate,
  updateCurrent,
  onReselect,
  onSelectParent,
  section,
  onSection,
  focusPending,
  onFocused,
  editorKey,
  dependencies,
  guardDelete,
}: {
  element: PageItem;
  child: ResolvedChild;
  onUpdate: (updates: Partial<PageItem>) => void;
  updateCurrent: AddressedWrite | undefined;
  /** Selects another child of the same element, as after a move or delete. */
  onReselect: (child: ChildTarget) => void;
  onSelectParent: () => void;
  section: SidebarSection;
  onSection: (section: SidebarSection) => void;
  focusPending: boolean;
  onFocused: () => void;
  /** Changes to remount the editor, as after undo. */
  editorKey: string;
  dependencies: ReactNode;
  /** Runs a deletion, or holds it for confirmation when something reads the child. */
  guardDelete: (run: () => void) => void;
}) {
  const view = childView({
    element,
    child,
    onUpdate,
    updateCurrent,
    onReselect,
  });
  const remove = () =>
    guardDelete(() => {
      view.remove();
      if (view.parent) onReselect(view.parent);
      else onSelectParent();
      onSection(SidebarSection.Content);
    });
  return (
    <SettingsSidebar
      parent={{ label: describeElement(element), onSelect: onSelectParent }}
      heading={view.heading}
      ownActions={{
        moveNoun: null,
        ...view.moves,
        moveToPage: null,
        duplicateLabel: "Duplicate",
        onDuplicate: null,
        onAddBelow: null,
        editJsonLabel: "",
        onEditJson: null,
        onShowInOutline: null,
        deleteLabel: view.deleteLabel,
        onDelete: remove,
      }}
      sections={view.sections}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      dependencies={dependencies}
      actions={view.id && <ReadOnlyId label={view.idLabel} value={view.id} />}
    >
      <div key={editorKey}>
        <ElementBoundary
          element={element}
          fallback={(message) => (
            <FlaggedSettings
              message={message}
              repair="Delete it from the More menu, or edit its element's JSON."
            />
          )}
        >
          {() => view.editor}
        </ElementBoundary>
      </div>
    </SettingsSidebar>
  );
}

function childView({
  element,
  child,
  onUpdate,
  updateCurrent,
  onReselect,
}: {
  element: PageItem;
  child: ResolvedChild;
  onUpdate: (updates: Partial<PageItem>) => void;
  updateCurrent: AddressedWrite | undefined;
  onReselect: (child: ChildTarget) => void;
}): ChildView {
  switch (child.kind) {
    case ChildKind.SubField: {
      if (element.kind !== "list")
        throw new Error("a sub-field outside a list");
      const fields = element.fields;
      const { index } = child;
      const sub = fields[index]!;
      const remove = () =>
        onUpdate({ fields: fields.filter((_, i) => i !== index) });
      return {
        heading: describeHeading(sub),
        sections: subFieldEditsConditions(sub)
          ? ALL_SECTIONS
          : UNCONDITIONAL_SECTIONS,
        moves: neighborMoves(fields, index, (next, to) => {
          onUpdate({ fields: next });
          onReselect(subFieldChild(next[to]!, to));
        }),
        idLabel: "Element ID",
        id: sub.id,
        deleteLabel: DELETION[PlaceKind.SubField].action,
        remove,
        parent: null,
        editor: (
          <ElementExpressionScope id={sub.id}>
            {renderSubFieldEditor(sub.kind, {
              field: sub,
              onUpdate: (updates) =>
                onUpdate({
                  fields: updateListSubField(fields, index, updates),
                }),
              previousFields: fields.slice(0, index),
              laterFields: fields.slice(index + 1),
            })}
          </ElementExpressionScope>
        ),
      };
    }
    case ChildKind.Section:
    case ChildKind.SectionBlock: {
      if (element.kind !== "accordion") {
        throw new Error("a section outside an accordion");
      }
      const sections = element.sections;
      const sectionIndex = child.section;
      const section = sections[sectionIndex]!;
      const {
        writeSections,
        updateSection: updateSectionAt,
        blockWrite,
      } = accordionWrites({ sections, onUpdate, updateCurrent });
      const updateSection = (
        update: (current: AccordionSection) => Partial<AccordionSection>,
      ) => updateSectionAt(sectionIndex, update);
      if (child.kind === ChildKind.Section) {
        return {
          heading: describeSection(section),
          sections: UNCONDITIONAL_SECTIONS,
          moves: neighborMoves(sections, sectionIndex, (next, to) => {
            writeSections(() => next);
            onReselect(sectionChild(next[to]!, to));
          }),
          idLabel: "Section ID",
          id: section.id,
          deleteLabel: "Delete section",
          remove: () =>
            writeSections((current) =>
              current.filter((_, i) => i !== sectionIndex),
            ),
          parent: null,
          editor: (
            <SectionPanels
              content={
                <div className="flex flex-col gap-1.5">
                  <span aria-hidden="true" className="font-medium">
                    Section title
                  </span>
                  <VariableTextField
                    value={section.title}
                    onChange={(title) => updateSection(() => ({ title }))}
                    aria-label="Section title"
                    placeholder="Section title"
                    className={cn(controlClass, "h-control")}
                  />
                </div>
              }
            />
          ),
        };
      }
      const blocks = section.blocks;
      const blockIndex = child.block;
      const block = blocks[blockIndex]!;
      const remove = () =>
        updateSection(() => ({
          blocks: blocks.filter((_, i) => i !== blockIndex),
        }));
      const updateCurrentBlock = blockWrite({ sectionIndex, blockIndex });
      return {
        heading: describeHeading(block),
        sections: UNCONDITIONAL_SECTIONS,
        moves: neighborMoves(blocks, blockIndex, (next, to) => {
          updateSection(() => ({ blocks: next }));
          onReselect(
            sectionBlockChild({
              section,
              sectionIndex,
              block: next[to]!,
              blockIndex: to,
            }),
          );
        }),
        idLabel: "Element ID",
        id: block.id,
        deleteLabel: "Delete block",
        remove,
        parent: sectionChild(section, sectionIndex),
        editor: (
          <PerViewerOptions allowed={false}>
            <EditableNestedBlock
              block={block}
              updateCurrent={updateCurrentBlock}
              onRemove={remove}
            />
          </PerViewerOptions>
        ),
      };
    }
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
}
