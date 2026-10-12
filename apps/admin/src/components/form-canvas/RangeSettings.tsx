import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { undefinedConditionNames } from "@alliance/shared/forms/visibilityFormula";
import { useState } from "react";
import { conditionSourceFields } from "../../lib/conditionSourceFields";
import { usesUndefinedRules } from "../../lib/formIssues";
import {
  newVisibilityCycle,
  sameVisibility,
  shareVisibility,
  type GroupedPages,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import { ConditionalVisibility } from "../form-fields/conditions/ConditionalVisibility";
import { LocalExpressionBuffers } from "../form-fields/conditions/expressionBuffers";
import { describeElement } from "./canvasSelection";
import { SectionPanels } from "./sidebarSections";

type RangeSettingsProps = {
  schema: FormSchema;
  pageIndex: number;
  start: number;
  end: number;
  groups: VisibilityGroups;
  applyGrouped: (grouped: GroupedPages) => void;
  summarize: (formula: VisibleIfFormula) => string;
  onSelectMember: (index: number) => void;
  onSelectGroup: (key: string) => void;
};

type FormulaChoice = { formula: VisibleIfFormula; holders: string[] };

/** The members' formulas, each once, with the members holding it. */
function currentFormulas(members: PageItem[]): FormulaChoice[] {
  const choices: FormulaChoice[] = [];
  for (const member of members) {
    const formula = member.visibleIfFormula;
    if (!formula) continue;
    const label = describeElement(member);
    const choice = choices.find((candidate) =>
      sameVisibility(candidate.formula, formula),
    );
    if (choice) {
      choice.holders.push(label);
    } else {
      choices.push({ formula, holders: [label] });
    }
  }
  return choices;
}

/** The key of the group the members make up exactly, if they do. */
function groupOf(members: PageItem[], groups: VisibilityGroups) {
  const key = members[0]?.id && groups.get(members[0].id);
  if (!key) return null;
  const size = [...groups.values()].filter((k) => k === key).length;
  return size === members.length &&
    members.every((member) => member.id && groups.get(member.id) === key)
    ? key
    : null;
}

export function RangeSettings({
  schema,
  pageIndex,
  start,
  end,
  groups,
  applyGrouped,
  summarize,
  onSelectMember,
  onSelectGroup,
}: RangeSettingsProps) {
  const [authored, setAuthored] = useState<VisibleIfFormula | undefined>();
  const members = schema.pages[pageIndex]?.fields.slice(start, end) ?? [];
  const withoutId = members.filter((member) => !member.id);
  const group = groupOf(members, groups);
  const unconditional = members
    .filter((member) => !member.visibleIfFormula)
    .map(describeElement);
  const memberIds = new Set(
    members.flatMap((member) => (member.id ? [member.id] : [])),
  );
  const sharing = (formula: VisibleIfFormula) =>
    shareVisibility({
      pages: schema.pages,
      groups,
      ids: [...memberIds],
      formula,
    });
  const cantShareReason = (formula: VisibleIfFormula): string | null => {
    const missing = undefinedConditionNames(formula);
    if (missing.length > 0) {
      return `Can't share: the expression ${usesUndefinedRules(missing)}.`;
    }
    const cycle = newVisibilityCycle({
      before: schema,
      after: { ...schema, pages: sharing(formula).pages },
    });
    return cycle && `Can't share: ${cycle}.`;
  };
  const authoredReason = authored ? cantShareReason(authored) : null;

  const share = (formula: VisibleIfFormula) => {
    const shared = sharing(formula);
    applyGrouped(shared);
    onSelectGroup(shared.key);
  };

  const conditions = () => {
    if (withoutId.length > 0) {
      return (
        <p className="text-sm text-red-700">
          Blocks without an ID can&apos;t share visibility:{" "}
          {withoutId.map(describeElement).join(", ")}. Give each an ID in its
          element JSON first.
        </p>
      );
    }
    if (group) {
      return (
        <div className="space-y-2 text-sm text-gray-700">
          <p>These elements already share visibility.</p>
          <button
            type="button"
            onClick={() => onSelectGroup(group)}
            className="text-blue-700 hover:underline"
          >
            Open group settings
          </button>
        </div>
      );
    }
    const sources = conditionSourceFields({
      pages: schema.pages,
      pageIndex,
      index: start,
      includeItem: true,
    });
    return (
      <>
        <p className="text-sm text-gray-700">
          Choose the visibility these elements will share. It replaces each
          element&apos;s own.
        </p>
        <ul aria-label="Current visibility" className="space-y-2">
          {currentFormulas(members).map(({ formula, holders }, index) => {
            const reason = cantShareReason(formula);
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={reason !== null}
                  onClick={() => share(formula)}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-left text-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-white disabled:text-gray-500"
                >
                  <span className="block font-medium">
                    Share: shown when {summarize(formula)}
                  </span>
                  <span className="block text-gray-600">
                    Now on {holders.join(", ")}
                  </span>
                  {reason && (
                    <span className="block text-amber-800">{reason}</span>
                  )}
                </button>
              </li>
            );
          })}
          {unconditional.length > 0 && (
            <li className="px-2 text-sm text-gray-600">
              Always shown now: {unconditional.join(", ")}
            </li>
          )}
        </ul>
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <p className="text-sm font-medium text-gray-800">
            Or share new rules
          </p>
          <LocalExpressionBuffers>
            <ConditionalVisibility
              field={{ visibleIfFormula: authored }}
              previousFields={sources.previousFields}
              laterFields={sources.laterFields.filter(
                (field) => !memberIds.has(field.id),
              )}
              onChange={({ visibleIfFormula }) => setAuthored(visibleIfFormula)}
            />
          </LocalExpressionBuffers>
          {authoredReason && (
            <p className="text-sm text-amber-800">{authoredReason}</p>
          )}
          <button
            type="button"
            disabled={!authored || authoredReason !== null}
            onClick={() => authored && share(authored)}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Share new rules
          </button>
        </div>
      </>
    );
  };

  return (
    <SectionPanels
      content={
        <ol aria-label="Selected elements" className="space-y-1">
          {members.map((member, offset) => (
            <li key={member.id || offset}>
              <button
                type="button"
                onClick={() => onSelectMember(start + offset)}
                className="w-full truncate rounded-md border border-gray-200 px-2 py-1 text-left text-sm text-gray-800 hover:text-blue-700"
              >
                {describeElement(member)}
              </button>
            </li>
          ))}
        </ol>
      }
      conditions={conditions()}
    />
  );
}
