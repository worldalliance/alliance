import type {
  AccordionSection,
  NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import type {
  ListSubField,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { updateListSubField } from "../../lib/updateListSubField";
import { EditableNestedBlock } from "../display-blocks/EditableNestedBlock";
import { PerViewerOptions } from "../display-blocks/PerViewerOptionsContext";
import { ElementExpressionScope } from "../form-fields/conditions/expressionBuffers";
import { SUB_FIELD_EDITORS } from "../form-fields/subFieldEditors";
import type {
  BaseFieldProps,
  FieldEditor,
  FieldOfKind,
} from "../form-fields/types";
import { VariableTextField } from "../VariableTextField";
import {
  addressOf,
  ChildKind,
  describeElement,
  describeHeading,
  describeSection,
  findAddressed,
  sectionBlockChild,
  sectionChild,
  subFieldChild,
  type ChildTarget,
  type ResolvedChild,
} from "./canvasSelection";
import { neighborMoves } from "./ChildRows";
import {
  SettingsAction,
  SettingsActions,
  SettingsMoveActions,
} from "./SettingsActions";
import { SettingsSidebar } from "./SettingsSidebar";
import {
  ALL_SECTIONS,
  SectionPanels,
  SidebarSection,
  UNCONDITIONAL_SECTIONS,
} from "./sidebarSections";

type ListSubFieldKind = ListSubField["kind"];

const LIST_SUB_FIELD_EDITORS: {
  [K in ListSubFieldKind]: FieldEditor<K> | null;
} = { ...SUB_FIELD_EDITORS, contract: null, custom: null };

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
        <p className="text-sm text-gray-500">
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
}) {
  const view = childView({
    element,
    child,
    onUpdate,
    updateCurrent,
    onReselect,
  });
  const remove = () => {
    view.remove();
    if (view.parent) onReselect(view.parent);
    else onSelectParent();
    onSection(SidebarSection.Content);
  };
  return (
    <SettingsSidebar
      parent={{ label: describeElement(element), onSelect: onSelectParent }}
      heading={view.heading}
      headingActions={<SettingsMoveActions {...view.moves} />}
      sections={view.sections}
      section={section}
      onSection={onSection}
      focusPending={focusPending}
      onFocused={onFocused}
      actions={
        <SettingsActions idLabel={view.idLabel} id={view.id}>
          <SettingsAction Icon={Trash2} destructive onClick={remove}>
            {view.deleteLabel}
          </SettingsAction>
        </SettingsActions>
      }
    >
      <div key={editorKey}>{view.editor}</div>
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
        sections: LIST_SUB_FIELD_EDITORS[sub.kind]
          ? ALL_SECTIONS
          : UNCONDITIONAL_SECTIONS,
        moves: neighborMoves(fields, index, (next, to) => {
          onUpdate({ fields: next });
          onReselect(subFieldChild(next[to]!, to));
        }),
        idLabel: "Element ID",
        id: sub.id,
        deleteLabel: "Delete question",
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
      // A nested upload lands after the render that started it, so writes
      // read the accordion as it stands.
      const writeSections = (
        update: (current: AccordionSection[]) => AccordionSection[],
      ) => {
        if (!updateCurrent) return onUpdate({ sections: update(sections) });
        updateCurrent((current) => {
          if (current.kind !== "accordion") {
            throw new Error(`accordion became ${current.kind}`);
          }
          return { sections: update(current.sections) };
        });
      };
      const updateSection = (
        update: (current: AccordionSection) => Partial<AccordionSection>,
      ) =>
        writeSections((current) => {
          const at = findAddressed(current, addressOf(section, sectionIndex));
          return current.map((candidate, i) =>
            i === at ? { ...candidate, ...update(candidate) } : candidate,
          );
        });
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
                <div>
                  <span className="mb-1 block text-xs font-medium text-gray-700">
                    Section title
                  </span>
                  <VariableTextField
                    value={section.title}
                    onChange={(title) => updateSection(() => ({ title }))}
                    aria-label="Section title"
                    placeholder="Section title"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
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
      const updateCurrentBlock: AddressedWrite = (update) => {
        let wrote: NestedDisplayBlock | null = null;
        updateSection((current) => {
          const at = findAddressed(
            current.blocks,
            addressOf(block, blockIndex),
          );
          return {
            blocks: current.blocks.map((candidate, i) => {
              if (i !== at) return candidate;
              wrote = candidate;
              // Safe: `update` answers with fields of `candidate`'s own kind.
              return {
                ...candidate,
                ...update(candidate),
              } as NestedDisplayBlock;
            }),
          };
        });
        return wrote;
      };
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
