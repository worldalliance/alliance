import type { FormSchema, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { undefinedConditionNames } from "@alliance/shared/forms/visibilityFormula";
import { useState } from "react";
import { conditionSourceFields } from "../../../../lib/conditionSourceFields";
import { usesUndefinedRules } from "../../../../lib/formIssues";
import {
  newVisibilityCycle,
  sameVisibility,
  shareVisibility,
  type GroupedPages,
  type VisibilityGroups,
} from "../../../../lib/visibilityGroups";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { Banner, BannerTone } from "../../../../ui/templates/Banner";
import { ConditionalVisibility } from "../conditions/ConditionalVisibility";
import { LocalExpressionBuffers } from "../conditions/expressionBuffers";
import { InspectorGroup } from "../kit/InspectorGroup";
import { describeElement } from "../selection/canvasSelection";
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
        <Banner inline tone={BannerTone.Danger}>
          Blocks without an ID can&apos;t share visibility:{" "}
          {withoutId.map(describeElement).join(", ")}. Give each an ID in its
          element JSON first.
        </Banner>
      );
    }
    if (group) {
      return (
        <InspectorGroup>
          <p>These elements already share visibility.</p>
          <div>
            <Button
              variant={ButtonVariant.Default}
              size="small"
              onClick={() => onSelectGroup(group)}
            >
              Open group settings
            </Button>
          </div>
        </InspectorGroup>
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
        <InspectorGroup description="Choose the visibility these elements will share. It replaces each element's own.">
          <ul aria-label="Current visibility" className="flex flex-col gap-2">
            {currentFormulas(members).map(({ formula, holders }, index) => {
              const reason = cantShareReason(formula);
              return (
                <li key={index}>
                  <button
                    type="button"
                    disabled={reason !== null}
                    onClick={() => share(formula)}
                    className="focus-ring flex w-full flex-col gap-0.5 rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors duration-fast hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-surface"
                  >
                    <span className="font-medium">
                      Share: shown when {summarize(formula)}
                    </span>
                    <span className="text-caption text-fg-muted">
                      Now on {holders.join(", ")}
                    </span>
                    {reason && (
                      <span className="text-caption text-danger">{reason}</span>
                    )}
                  </button>
                </li>
              );
            })}
            {unconditional.length > 0 && (
              <li className="text-caption text-fg-muted">
                Always shown now: {unconditional.join(", ")}
              </li>
            )}
          </ul>
        </InspectorGroup>
        <InspectorGroup title="Or share new rules">
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
            <p className="text-caption text-danger">{authoredReason}</p>
          )}
          <div>
            <Button
              variant={ButtonVariant.Default}
              size="small"
              disabled={!authored || authoredReason !== null}
              onClick={() => authored && share(authored)}
            >
              Share new rules
            </Button>
          </div>
        </InspectorGroup>
      </>
    );
  };

  return (
    <SectionPanels
      content={
        <InspectorGroup>
          <ol aria-label="Selected elements" className="flex flex-col gap-2">
            {members.map((member, offset) => (
              <li key={member.id || offset}>
                <button
                  type="button"
                  onClick={() => onSelectMember(start + offset)}
                  title={describeElement(member)}
                  className="focus-ring w-full truncate rounded-md border border-line bg-surface px-2.5 py-1.5 text-left hover:underline"
                >
                  {describeElement(member)}
                </button>
              </li>
            ))}
          </ol>
        </InspectorGroup>
      }
      conditions={conditions()}
    />
  );
}
