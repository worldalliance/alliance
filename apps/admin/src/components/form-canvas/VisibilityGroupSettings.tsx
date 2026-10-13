import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { conditionSourceFields } from "../../lib/conditionSourceFields";
import {
  detachMember,
  pageSegments,
  SegmentKind,
  setGroupVisibility,
  splitGroup,
  ungroup,
  type GroupedPages,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import {
  expressionKeys,
  ExpressionScope,
} from "../form-fields/conditions/expressionBuffers";
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
  onSelectMember: (index: number) => void;
};

export function VisibilityGroupSettings({
  schema,
  pageIndex,
  groupKey,
  groups,
  setGroups,
  applyGrouped,
  summarize,
  onSelectMember,
}: VisibilityGroupSettingsProps) {
  const fields = schema.pages[pageIndex]?.fields ?? [];
  const segment = pageSegments(fields, groups).find(
    (candidate) =>
      candidate.kind === SegmentKind.Group && candidate.key === groupKey,
  );
  if (segment?.kind !== SegmentKind.Group) {
    throw new Error(`no visibility group ${groupKey} on page ${pageIndex}`);
  }
  const { key, start, end } = segment;
  const members = fields.slice(start, end);
  const formula = members[0]?.visibleIfFormula;
  if (!formula) throw new Error(`visibility group ${key} has no condition`);

  const { previousFields, laterFields } = conditionSourceFields({
    pages: schema.pages,
    pageIndex,
    index: start,
    includeItem: true,
  });

  return (
    <ExpressionScope.Provider value={expressionKeys.group(key)}>
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
      />
    </ExpressionScope.Provider>
  );
}
