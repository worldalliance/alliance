import type { AnyField, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { InspectorGroup } from "../kit/InspectorGroup";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { MoreMenu } from "../../../../ui/MoreMenu";
import { ConditionalVisibility } from "../conditions/ConditionalVisibility";
import { SectionPanels } from "./sidebarSections";

type GroupMember = {
  label: string;
  select: () => void;
  detach: () => void;
  /** Starts a group of its own from this member on. */
  splitBefore: () => void;
};

type VisibilityGroupPanelProps = {
  firstMember: PageItem;
  members: GroupMember[];
  summary: string;
  previousFields: AnyField[];
  laterFields: AnyField[];
  onChangeVisibility: (formula: VisibleIfFormula | undefined) => void;
  onUngroup: () => void;
};

/** A group's shared rule, as its settings and its members' show it. */
export function SharedRuleSummary({
  heading,
  summary,
}: {
  heading: string;
  summary: string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-caption font-medium text-fg-muted">{heading}</p>
      <p className="break-words">Shown when {summary}</p>
    </div>
  );
}

export function VisibilityGroupPanel({
  firstMember,
  members,
  summary,
  previousFields,
  laterFields,
  onChangeVisibility,
  onUngroup,
}: VisibilityGroupPanelProps) {
  return (
    <SectionPanels
      content={
        <>
          <InspectorGroup>
            <ol aria-label="Group members" className="flex flex-col gap-2">
              {members.map((member, offset) => (
                <li
                  key={offset}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-surface py-1 pr-1 pl-2.5"
                >
                  <button
                    type="button"
                    onClick={member.select}
                    title={member.label}
                    className="focus-ring min-w-0 flex-1 truncate rounded-sm text-left hover:underline"
                  >
                    {member.label}
                  </button>
                  <MoreMenu
                    subject={member.label}
                    size="small"
                    items={[
                      ...(offset > 0
                        ? [
                            {
                              label: `Split group before ${member.label}`,
                              onSelect: member.splitBefore,
                            },
                          ]
                        : []),
                      {
                        label: `Edit ${member.label}'s visibility separately`,
                        onSelect: member.detach,
                      },
                    ]}
                  />
                </li>
              ))}
            </ol>
          </InspectorGroup>
          <InspectorGroup>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={onUngroup}
              >
                Ungroup all
              </Button>
              <Button
                variant={ButtonVariant.Default}
                size="small"
                onClick={() => onChangeVisibility(undefined)}
              >
                Clear visibility
              </Button>
            </div>
            <p className="text-caption text-fg-muted">
              Ungroup all keeps each element&apos;s visibility. Clear
              visibility removes the rule from every element in the group.
            </p>
          </InspectorGroup>
        </>
      }
      conditions={
        <>
          <SharedRuleSummary
            heading={`Shared visibility · ${withCount(members.length, "element")}`}
            summary={summary}
          />
          <ConditionalVisibility
            field={firstMember}
            previousFields={previousFields}
            laterFields={laterFields}
            onChange={({ visibleIfFormula }) =>
              onChangeVisibility(visibleIfFormula)
            }
          />
        </>
      }
    />
  );
}
