import type { ConditionHolder } from "@alliance/common/forms/form-conditions";
import { PlaceKind } from "@alliance/common/forms/form-conditions";
import {
  isQuestionField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { useMemo } from "react";
import { conditionSourceFields } from "../lib/conditionSourceFields";
import { addressedWrite, type BlockWriteById } from "../lib/displayBlockById";
import { JsonScopeKind, type JsonScope } from "../lib/formJson";
import { DropPosition } from "../lib/useDragReorder";
import {
  NeighborDirection,
  stepPast,
  type VisibilityGroups,
} from "../lib/visibilityGroups";
import type { ConditionFieldLookup } from "../lib/visibilitySummary";
import { PerViewerOptions } from "./display-blocks";
import { renderBlockEditor } from "./display-blocks/blockEditors";
import {
  OverrideTargetContext,
  type OverrideTarget,
} from "./display-blocks/perUserContent";
import {
  CanvasTargetKind,
  ChildKind,
  childPlace,
  elementTarget,
} from "./form-canvas/canvasSelection";
import { SelectChildProvider } from "./form-canvas/ChildRows";
import { ChildSettings } from "./form-canvas/ChildSettings";
import { DependencyLinks } from "./form-canvas/DependencyLinks";
import {
  ElementBoundary,
  FlaggedSettings,
} from "./form-canvas/ElementBoundary";
import { ElementSettings } from "./form-canvas/ElementSettings";
import { PageSettings, PageSettingsSidebar } from "./form-canvas/PageSettings";
import { RangeSettings } from "./form-canvas/RangeSettings";
import { SettingsSidebar } from "./form-canvas/SettingsSidebar";
import { SidebarSection } from "./form-canvas/sidebarSections";
import type { CanvasEdits } from "./form-canvas/useCanvasEdits";
import type { CanvasSelectionState } from "./form-canvas/useCanvasSelection";
import { VisibilityGroupSettings } from "./form-canvas/VisibilityGroupSettings";
import {
  ElementExpressionScope,
  expressionKeys,
} from "./form-fields/conditions/expressionBuffers";
import { renderFieldEditor } from "./form-fields/fieldEditors";
import {
  VisibilityGroupContext,
  visibilityGroupMember,
} from "./VisibilityGroupContext";

const GROUP_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];
const RANGE_SECTIONS = [SidebarSection.Content, SidebarSection.Conditions];

export function FormBuilderSettings({
  schema,
  displayOnly,
  visibilityGroups,
  setGroups,
  canvasGroups,
  canvas,
  edits,
  updateBlockById,
  conditionFieldOf,
  summarize,
  overrideTarget,
  onEditJson,
}: {
  schema: FormSchema;
  displayOnly: boolean;
  visibilityGroups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  canvasGroups: VisibilityGroups;
  canvas: CanvasSelectionState;
  edits: CanvasEdits;
  updateBlockById: BlockWriteById;
  conditionFieldOf: ConditionFieldLookup;
  summarize: (formula: VisibleIfFormula) => string;
  overrideTarget: OverrideTarget;
  onEditJson: (scope: JsonScope) => void;
}) {
  const {
    currentPage,
    selectedPageIndex,
    setSelection,
    resolvedTarget,
    selectionKey,
    schemaLoads,
    section,
    setSection,
    focusPending,
    focused,
    select,
    selectFromOutline,
  } = canvas;
  const {
    guardDeletion,
    updateCurrentPage,
    movePage,
    copyPage,
    removePage,
    deleteElement,
    moveElement,
    duplicateElement,
    applyGrouped,
    updateElementAt,
    selectChildOf,
  } = edits;

  // Fields a page-level visibility condition can reference: anything answered
  // before this page can show, i.e. fields on earlier pages.
  const pagePreviousFields = useMemo(
    () =>
      schema.pages
        .slice(0, selectedPageIndex)
        .flatMap((page) => page.fields)
        .filter(isQuestionField),
    [schema.pages, selectedPageIndex],
  );

  const renderElementEditor = (index: number) => {
    const field = currentPage.fields[index];
    if (!field) return null;
    const updateField = updateElementAt(index);

    const { previousFields, laterFields } = conditionSourceFields({
      pages: schema.pages,
      pageIndex: selectedPageIndex,
      index,
    });
    const commonProps = {
      onUpdate: updateField,
      updateCurrent: addressedWrite(field, updateBlockById),
      onRemove: () => deleteElement(index),
      previousFields,
      laterFields,
    };
    return (
      <ElementExpressionScope
        parent={expressionKeys.pageElements(currentPage.id)}
        id={field.id}
      >
        <VisibilityGroupContext.Provider
          value={
            displayOnly
              ? null
              : visibilityGroupMember({
                  element: field,
                  groups: visibilityGroups,
                  setGroups,
                  summarize,
                  onOpenGroup: (key) =>
                    select(
                      { kind: CanvasTargetKind.Group, key },
                      SidebarSection.Conditions,
                    ),
                })
          }
        >
          <PerViewerOptions allowed={!displayOnly}>
            <SelectChildProvider value={selectChildOf(index)}>
              {isQuestionField(field)
                ? renderFieldEditor({ field, ...commonProps })
                : renderBlockEditor({ block: field, ...commonProps })}
            </SelectChildProvider>
          </PerViewerOptions>
        </VisibilityGroupContext.Provider>
      </ElementExpressionScope>
    );
  };

  const renderDependencies = (
    item: ConditionHolder["formulas"],
    questionId: string | null,
  ) =>
    !displayOnly && (
      <DependencyLinks
        pages={schema.pages}
        groups={canvasGroups}
        item={item}
        questionId={questionId}
        fieldOf={conditionFieldOf}
        onSelect={(pageIndex, target) =>
          selectFromOutline({
            page: schema.pages[pageIndex]!,
            pageIndex,
            target,
            section: SidebarSection.Conditions,
          })
        }
      />
    );

  switch (resolvedTarget.kind) {
    case CanvasTargetKind.Page:
      return displayOnly ? (
        <p className="p-4 text-sm text-gray-500">
          Select a block on the canvas to edit it.
        </p>
      ) : (
        <PageSettingsSidebar
          pageId={currentPage.id}
          section={section}
          onSection={setSection}
          focusPending={focusPending}
          onFocused={focused}
          onMoveUp={
            selectedPageIndex > 0
              ? () =>
                  movePage({
                    from: selectedPageIndex,
                    dropIndex: selectedPageIndex - 1,
                    position: DropPosition.Before,
                  })
              : null
          }
          onMoveDown={
            selectedPageIndex < schema.pages.length - 1
              ? () =>
                  movePage({
                    from: selectedPageIndex,
                    dropIndex: selectedPageIndex + 1,
                    position: DropPosition.After,
                  })
              : null
          }
          onEditJson={() =>
            onEditJson({
              kind: JsonScopeKind.Page,
              pageIndex: selectedPageIndex,
            })
          }
          onCopy={() => copyPage(selectedPageIndex)}
          onDelete={
            schema.pages.length > 1
              ? () =>
                  guardDeletion(
                    { kind: PlaceKind.Page, pageIndex: selectedPageIndex },
                    () => removePage(selectedPageIndex),
                  )
              : null
          }
          dependencies={renderDependencies(currentPage, null)}
        >
          <PageSettings
            key={`${currentPage.id}-${schemaLoads}`}
            page={currentPage}
            isFirstPage={selectedPageIndex === 0}
            previousFields={pagePreviousFields}
            onUpdate={updateCurrentPage}
          />
        </PageSettingsSidebar>
      );
    case CanvasTargetKind.Element: {
      const { index, child } = resolvedTarget;
      const element = currentPage.fields[index]!;
      if (child) {
        const sub =
          child.kind === ChildKind.SubField && element.kind === "list"
            ? element.fields[child.index]
            : undefined;
        return (
          <ElementExpressionScope
            parent={expressionKeys.pageElements(currentPage.id)}
            id={element.id}
          >
            <ChildSettings
              element={element}
              child={child}
              onUpdate={updateElementAt(index)}
              updateCurrent={addressedWrite(element, updateBlockById)}
              onReselect={(next) =>
                setSelection({
                  pageId: currentPage.id,
                  target: { ...elementTarget(element, index), child: next },
                })
              }
              onSelectParent={() =>
                select(elementTarget(element, index), SidebarSection.Content)
              }
              section={section}
              onSection={setSection}
              focusPending={focusPending}
              onFocused={focused}
              editorKey={`${selectionKey}-${schemaLoads}`}
              dependencies={sub && renderDependencies(sub, sub.id)}
              guardDelete={(run) => {
                const place = childPlace({
                  pageIndex: selectedPageIndex,
                  index,
                  child,
                });
                return place ? guardDeletion(place, run) : run();
              }}
            />
          </ElementExpressionScope>
        );
      }
      const stepTo = (direction: NeighborDirection) => {
        const step = stepPast({
          fields: currentPage.fields,
          groups: canvasGroups,
          index,
          direction,
        });
        return step && (() => moveElement({ from: index, ...step }));
      };
      return (
        <ElementSettings
          element={element}
          displayOnly={displayOnly}
          section={section}
          onSection={setSection}
          focusPending={focusPending}
          onFocused={focused}
          onMoveUp={stepTo(NeighborDirection.Previous)}
          onMoveDown={stepTo(NeighborDirection.Next)}
          onEditJson={() =>
            onEditJson({
              kind: JsonScopeKind.Element,
              pageIndex: selectedPageIndex,
              index,
            })
          }
          onDuplicate={() => duplicateElement(index)}
          onDelete={() => deleteElement(index)}
          dependencies={renderDependencies(
            element,
            isQuestionField(element) ? element.id : null,
          )}
        >
          <div key={`${element.id || index}-${schemaLoads}`}>
            <OverrideTargetContext.Provider value={overrideTarget}>
              <ElementBoundary
                element={element}
                fallback={(message) => (
                  <FlaggedSettings
                    message={message}
                    repair="Edit its JSON, or delete it, under Advanced."
                  />
                )}
              >
                {() => renderElementEditor(index)}
              </ElementBoundary>
            </OverrideTargetContext.Provider>
          </div>
        </ElementSettings>
      );
    }
    case CanvasTargetKind.Group:
      return (
        <SettingsSidebar
          heading="Shared visibility"
          sections={GROUP_SECTIONS}
          section={section}
          onSection={setSection}
          focusPending={focusPending}
          onFocused={focused}
          dependencies={renderDependencies(
            {
              visibleIfFormula:
                currentPage.fields[resolvedTarget.start]?.visibleIfFormula,
            },
            null,
          )}
        >
          <VisibilityGroupSettings
            key={`${resolvedTarget.key}-${schemaLoads}`}
            schema={schema}
            pageIndex={selectedPageIndex}
            groupKey={resolvedTarget.key}
            groups={visibilityGroups}
            setGroups={setGroups}
            applyGrouped={applyGrouped}
            summarize={summarize}
            onSelectMember={(memberIndex) =>
              select(
                elementTarget(currentPage.fields[memberIndex]!, memberIndex),
                SidebarSection.Content,
              )
            }
          />
        </SettingsSidebar>
      );
    case CanvasTargetKind.Range: {
      const { start, end } = resolvedTarget;
      return (
        <SettingsSidebar
          heading={`${withCount(end - start, "element")} selected`}
          sections={RANGE_SECTIONS}
          section={section}
          onSection={setSection}
          focusPending={focusPending}
          onFocused={focused}
        >
          <RangeSettings
            key={`${selectionKey}-${schemaLoads}`}
            schema={schema}
            pageIndex={selectedPageIndex}
            start={start}
            end={end}
            groups={visibilityGroups}
            applyGrouped={applyGrouped}
            summarize={summarize}
            onSelectGroup={(key) =>
              select(
                { kind: CanvasTargetKind.Group, key },
                SidebarSection.Conditions,
              )
            }
            onSelectMember={(index) =>
              select(
                elementTarget(currentPage.fields[index]!, index),
                SidebarSection.Content,
              )
            }
          />
        </SettingsSidebar>
      );
    }
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(resolvedTarget satisfies never)}`,
      );
  }
}
