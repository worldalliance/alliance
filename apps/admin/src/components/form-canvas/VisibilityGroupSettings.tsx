import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { FormSchemaValidationError } from "@alliance/common/forms/form-schema-validate";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { conditionSourceFields } from "../../lib/conditionSourceFields";
import {
  detachMember,
  mergeGroups,
  NeighborDirection,
  pageSegments,
  SegmentKind,
  setGroupVisibility,
  splitGroup,
  ungroup,
  type GroupedPages,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import { ExpressionScope } from "../form-fields/conditions/expressionBuffers";
import { describeElement } from "./canvasSelection";
import { VisibilityGroupPanel } from "./VisibilityGroupPanel";

type VisibilityGroupSettingsProps = {
  schema: FormSchema;
  pageIndex: number;
  groupKey: string;
  groups: VisibilityGroups;
  setGroups: (groups: VisibilityGroups) => void;
  applyGrouped: (grouped: GroupedPages) => void;
  summarize: (formula: VisibleIfFormula) => string;
  validationErrors: FormSchemaValidationError[];
  onSelectMember: (index: number) => void;
  /** The group goes on under `key`, as after merging into the previous one. */
  onRekey: (key: string) => void;
};

export function VisibilityGroupSettings({
  schema,
  pageIndex,
  groupKey,
  groups,
  setGroups,
  applyGrouped,
  summarize,
  validationErrors,
  onSelectMember,
  onRekey,
}: VisibilityGroupSettingsProps) {
  const fields = schema.pages[pageIndex]?.fields ?? [];
  const segments = pageSegments(fields, groups);
  const segmentIndex = segments.findIndex(
    (candidate) =>
      candidate.kind === SegmentKind.Group && candidate.key === groupKey,
  );
  const segment = segments[segmentIndex];
  if (segment?.kind !== SegmentKind.Group) {
    throw new Error(`no visibility group ${groupKey} on page ${pageIndex}`);
  }
  const { key, start, end } = segment;
  const members = fields.slice(start, end);
  const formula = members[0]?.visibleIfFormula;
  if (!formula) throw new Error(`visibility group ${key} has no condition`);
  const memberById = new Map(members.map((member) => [member.id, member]));

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
    <ExpressionScope.Provider value={`group:${key}`}>
      <VisibilityGroupPanel
        firstMember={members[0]!}
        members={members.map((member, offset) => ({
          label: describeElement(member),
          select: () => onSelectMember(start + offset),
          detach: () => member.id && setGroups(detachMember(groups, member.id)),
          splitBefore: () =>
            setGroups(
              splitGroup(groups, { fields, key, index: start + offset }),
            ),
        }))}
        formula={formula}
        summary={summarize(formula)}
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
          if (previousKey !== key) onRekey(previousKey);
        }}
        errors={validationErrors.flatMap((error) => {
          const member = memberById.get(error.blockId);
          return member
            ? [
                `${elementInternalDescriptor(member, { maxTextLength: 40 })}: ${error.message}`,
              ]
            : [];
        })}
      />
    </ExpressionScope.Provider>
  );
}
