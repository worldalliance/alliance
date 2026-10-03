import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type FormSchema,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import type { FormSchemaValidationError } from "@alliance/common/forms/form-schema-validate";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { conditionSourceFields } from "../lib/conditionSourceFields";
import {
  mergeGroups,
  NeighborDirection,
  SegmentKind,
  setGroupVisibility,
  splitGroup,
  ungroup,
  type GroupedPages,
  type PageSegment,
  type VisibilityGroups,
} from "../lib/visibilityGroups";
import { summarizeVisibility } from "../lib/visibilitySummary";
import { VisibilityGroupCard } from "./VisibilityGroupCard";

type VisibilityGroupSegmentProps = {
  schema: FormSchema;
  pageIndex: number;
  segments: PageSegment[];
  segmentIndex: number;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  applyGrouped: (grouped: GroupedPages) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  validationErrors: FormSchemaValidationError[];
  renderInsertPoint: (loc: {
    groupKey: string | null;
    index: number;
  }) => ReactNode;
  renderMember: (params: { field: PageItem; index: number }) => ReactNode;
};

export function VisibilityGroupSegment({
  schema,
  pageIndex,
  segments,
  segmentIndex,
  groups,
  setGroups,
  applyGrouped,
  collapsed,
  onToggleCollapsed,
  validationErrors,
  renderInsertPoint,
  renderMember,
}: VisibilityGroupSegmentProps) {
  const fields = schema.pages[pageIndex]?.fields ?? [];
  const segment = segments[segmentIndex];
  if (segment?.kind !== SegmentKind.Group) {
    throw new Error(`segment ${segmentIndex} is not a visibility group`);
  }
  const { key, start, end } = segment;
  const members = fields.slice(start, end);
  const formula = members[0]?.visibleIfFormula;
  if (!formula) throw new Error(`visibility group ${key} has no condition`);
  const memberById = new Map(members.map((member) => [member.id, member]));

  const fieldLabel = (fieldId: string) =>
    schema.pages
      .flatMap((page) => page.fields)
      .filter(isQuestionField)
      .find((element) => element.id === fieldId)?.label || fieldId;
  const summarize = (visibility: VisibleIfFormula) =>
    summarizeVisibility(visibility, fieldLabel);

  const neighborAt = (neighborIndex: number) => {
    const neighbor = segments[neighborIndex];
    const neighborFormula =
      neighbor?.kind === SegmentKind.Group
        ? fields[neighbor.start]?.visibleIfFormula
        : undefined;
    return neighbor?.kind === SegmentKind.Group && neighborFormula
      ? { key: neighbor.key, formula: neighborFormula }
      : null;
  };
  const previous = neighborAt(segmentIndex - 1);
  const next = neighborAt(segmentIndex + 1);
  const candidate = (neighbor: typeof previous) =>
    neighbor && {
      formula: neighbor.formula,
      summary: summarize(neighbor.formula),
    };
  const { previousFields, laterFields } = conditionSourceFields({
    pages: schema.pages,
    pageIndex,
    index: start,
    includeItem: true,
  });

  return (
    <VisibilityGroupCard
      firstMember={members[0]}
      memberCount={members.length}
      formula={formula}
      summary={summarize(formula)}
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      previousFields={previousFields}
      laterFields={laterFields}
      onChangeVisibility={(nextFormula) =>
        applyGrouped(
          setGroupVisibility({
            pages: schema.pages,
            groups,
            key,
            formula: nextFormula,
          }),
        )
      }
      onUngroup={() => setGroups(ungroup(groups, key))}
      mergeCandidates={{
        [NeighborDirection.Previous]: candidate(previous),
        [NeighborDirection.Next]: candidate(next),
      }}
      onMerge={({ direction, formula: mergedFormula }) => {
        const pair = {
          [NeighborDirection.Previous]: previous && [previous.key, key],
          [NeighborDirection.Next]: next && [key, next.key],
        }[direction];
        if (!pair) return;
        const [previousKey, nextKey] = pair;
        applyGrouped(
          mergeGroups({
            pages: schema.pages,
            groups,
            previousKey,
            nextKey,
            formula: mergedFormula,
          }),
        );
      }}
      errors={validationErrors.flatMap((error) => {
        const member = memberById.get(error.blockId);
        return member
          ? [
              `${elementInternalDescriptor(member, { maxTextLength: 40 })}: ${error.message}`,
            ]
          : [];
      })}
    >
      {members.map((member, offset) => {
        const index = start + offset;
        return (
          <div key={member.id || index}>
            {offset > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  {renderInsertPoint({ groupKey: key, index })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setGroups(splitGroup(groups, { fields, key, index }))
                  }
                  aria-label="Split group here"
                  title="Split group here"
                  className="rounded p-1 text-gray-400 hover:bg-amber-100 hover:text-gray-700"
                >
                  <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
            {renderMember({ field: member, index })}
          </div>
        );
      })}
      {renderInsertPoint({ groupKey: key, index: end })}
    </VisibilityGroupCard>
  );
}
