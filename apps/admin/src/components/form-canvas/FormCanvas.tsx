import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { cn } from "@alliance/shared/styles/util";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import { selectionRing } from "./CanvasContent";
import { CanvasElement } from "./CanvasElement";
import {
  CanvasTargetKind,
  describeElement,
  elementTarget,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import { ConditionsIndicator } from "./ConditionsIndicator";
import type { InsertLoc } from "./InsertPoint";
import { SidebarSection } from "./sidebarSections";
import { useListDrag, type ListMove } from "./useListDrag";

type FormCanvasProps = {
  page: Page;
  groups: VisibilityGroups;
  displayOnly: boolean;
  selected: ResolvedTarget;
  onSelect: (target: CanvasTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
  /** Elements the form's validation faults, by id. */
  invalidIds: ReadonlySet<string>;
  renderInsertPoint: (
    loc: InsertLoc,
    options?: { prominent: true },
  ) => ReactNode;
  onMove: (move: ListMove) => void;
};

/** The selected page as respondents see it, with selection and editing overlays. */
export function FormCanvas({
  page,
  groups,
  displayOnly,
  selected,
  onSelect,
  summarize,
  invalidIds,
  renderInsertPoint,
  onMove,
}: FormCanvasProps) {
  const fields = page.fields;
  const { acceptDrop, drop, dragFor } = useListDrag<string>((_, move) =>
    onMove(move),
  );

  const renderElement = (
    element: PageItem,
    index: number,
    inGroup: boolean,
  ) => {
    const target =
      selected.kind === CanvasTargetKind.Element && selected.index === index
        ? selected
        : null;
    return (
      <CanvasElement
        key={element.id || index}
        element={element}
        label={describeElement(element)}
        selected={target !== null && !target.child}
        selectedChild={target?.child}
        onSelect={(section) => onSelect(elementTarget(element, index), section)}
        onSelectChild={(child, section) =>
          onSelect({ ...elementTarget(element, index), child }, section)
        }
        summarize={summarize}
        conditionSummary={
          !displayOnly && !inGroup && element.visibleIfFormula
            ? summarize(element.visibleIfFormula)
            : null
        }
        drag={dragFor(page.id, index)}
      />
    );
  };

  const segments = pageSegments(fields, groups);
  const pageSelected = selected.kind === CanvasTargetKind.Page;

  return (
    <div
      className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white px-10 py-8"
      onDragOver={acceptDrop}
      onDrop={drop}
    >
      {!displayOnly && (
        <div className="relative mb-4 flex items-start gap-2">
          <button
            type="button"
            onClick={() =>
              onSelect({ kind: CanvasTargetKind.Page }, SidebarSection.Content)
            }
            aria-label={`Page settings: ${page.title || "Untitled page"}`}
            aria-pressed={pageSelected}
            className={cn(
              "-mx-3 flex-1 rounded-md px-3 py-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              selectionRing(pageSelected),
            )}
          >
            <span
              className={cn(
                "block text-xl font-semibold",
                page.title ? "text-gray-900" : "text-gray-400",
              )}
            >
              {page.title || "Untitled page"}
            </span>
            {page.description && (
              <span className="mt-1 block text-gray-600">
                {page.description}
              </span>
            )}
          </button>
          {page.visibleIfFormula && (
            <ConditionsIndicator
              onClick={() =>
                onSelect(
                  { kind: CanvasTargetKind.Page },
                  SidebarSection.Conditions,
                )
              }
              label={`Edit page conditions: shown when ${summarize(page.visibleIfFormula)}`}
              title={`Page shown when ${summarize(page.visibleIfFormula)}`}
              className="mt-1 shrink-0"
            />
          )}
        </div>
      )}
      {fields.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          {displayOnly
            ? "This update is empty. Add some content to get started."
            : "This page is empty. Add a question or some content to get started."}
        </p>
      )}
      {segments.map((segment) => {
        switch (segment.kind) {
          case SegmentKind.Single: {
            const element = fields[segment.index]!;
            return (
              <div key={element.id || segment.index}>
                {renderInsertPoint({ groupKey: null, index: segment.index })}
                {renderElement(element, segment.index, false)}
              </div>
            );
          }
          case SegmentKind.Group: {
            const { key, start, end } = segment;
            const formula = fields[start]?.visibleIfFormula;
            const groupSelected =
              selected.kind === CanvasTargetKind.Group && selected.key === key;
            const errors = fields
              .slice(start, end)
              .filter(
                (member) => member.id && invalidIds.has(member.id),
              ).length;
            return (
              <div key={key}>
                {renderInsertPoint({ groupKey: null, index: start })}
                <section
                  aria-label="Visibility group"
                  className={cn(
                    "-mx-4 rounded-lg border border-dashed border-amber-300 bg-amber-50/30 px-4 pb-2",
                    groupSelected && "ring-2 ring-blue-500",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onSelect(
                        { kind: CanvasTargetKind.Group, key },
                        SidebarSection.Conditions,
                      )
                    }
                    aria-pressed={groupSelected}
                    className="block w-full rounded py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className="block text-xs font-medium uppercase tracking-wide text-amber-800">
                      Shared visibility · {withCount(end - start, "element")}
                    </span>
                    {formula && (
                      <span className="block break-words text-sm text-gray-700">
                        Shown when {summarize(formula)}
                      </span>
                    )}
                    {errors > 0 && (
                      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-red-700">
                        <TriangleAlert
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        {withCount(errors, "member")} with errors
                      </span>
                    )}
                  </button>
                  {fields.slice(start, end).map((member, offset) => {
                    const index = start + offset;
                    return (
                      <div key={member.id || index}>
                        {offset > 0 &&
                          renderInsertPoint({ groupKey: key, index })}
                        {renderElement(member, index, true)}
                      </div>
                    );
                  })}
                  {renderInsertPoint({ groupKey: key, index: end })}
                </section>
              </div>
            );
          }
          default:
            throw new Error(
              `unknown segment: ${JSON.stringify(segment satisfies never)}`,
            );
        }
      })}
      {renderInsertPoint(
        { groupKey: null, index: fields.length },
        { prominent: true },
      )}
    </div>
  );
}
