import { useState } from "react";
import { Link } from "react-router";
import OpenReferenceWarning from "../../../components/OpenReferenceWarning";
import {
  inPartitionedSuite,
  suiteKindUnknown,
} from "../../../lib/actionFieldDefs";
import { suiteHref } from "../../../lib/hrefs";
import { linkClass } from "../../../ui/styles";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import {
  CheckboxField,
  FieldGroup,
  FormSection,
} from "../../../ui/templates/Form";
import CohortExpressionBuilder from "../cohort/CohortExpressionBuilder";
import PrerequisitePicker from "../cohort/PrerequisitePicker";
import type { DetailsSectionProps } from "./detailsRules";

const dateOrNull = (value: string | null | undefined) =>
  value ? new Date(value) : null;

export function ParticipationSection({
  editor,
  lookups,
  task,
}: DetailsSectionProps) {
  const { form, cohortExpression } = editor;
  const prerequisites = form.prerequisiteActionIds ?? [];
  const kindUnknown = suiteKindUnknown(
    { loading: lookups.suitesLoading, failed: lookups.suitesError },
    form.suiteId,
  );
  const partitioned = inPartitionedSuite(
    lookups.availableSuites ?? [],
    form.suiteId,
  );
  // A partitioned suite refuses a task's own rules, such as on a task just
  // moved into one. They stay shown once cleared, so the control that
  // cleared them keeps focus.
  const ownRules = cohortExpression != null || prerequisites.length > 0;
  const rulesScope = `${task?.id}:${form.suiteId}`;
  const [heldRulesIn, setHeldRulesIn] = useState<string | null>(null);
  if (ownRules && heldRulesIn !== rulesScope) setHeldRulesIn(rulesScope);
  const showRules =
    !kindUnknown && (!partitioned || heldRulesIn === rulesScope);

  return (
    <FormSection
      title="Who takes part"
      description="Who is assigned the task, reminded and counted."
    >
      {partitioned && form.suiteId != null && (
        <p>
          This task's suite is partitioned: its partition decides who gets the
          task and whether it's optional.{" "}
          <Link className={linkClass} to={suiteHref(form.suiteId)}>
            Edit the suite's partition
          </Link>
        </p>
      )}
      {partitioned && ownRules && (
        <Banner tone={BannerTone.Danger} inline>
          Clear this task's prerequisites and participants below before saving.
        </Banner>
      )}
      {kindUnknown &&
        (lookups.suitesError ? (
          <Banner tone={BannerTone.Danger} inline>
            Suites couldn't load, so optional work, prerequisites and
            participants are hidden. Reload the page to try again.
          </Banner>
        ) : (
          <p role="status" className="text-fg-muted">
            Prerequisites and participants show once suites load.
          </p>
        ))}
      {showRules && (
        <>
          <FieldGroup
            label="Prerequisites"
            help="Each member waits until every prerequisite resolves for them (they complete or withdraw, it excludes them, or its deadline passes) before the conditions below decide whether they take part."
          >
            <PrerequisitePicker
              value={prerequisites}
              onChange={editor.handlePrerequisitesChange}
              availableActions={lookups.allActions ?? []}
              actionId={task?.id}
              loading={lookups.allActionsLoading}
            />
          </FieldGroup>
          <FieldGroup
            label="Participating members"
            help="The conditions that decide which members take part."
          >
            <CohortExpressionBuilder
              value={cohortExpression}
              onChange={editor.handleCohortExpressionChange}
              availableTags={lookups.availableTags ?? []}
              tagsLoading={lookups.tagsLoading}
              tagsError={lookups.tagsError}
              availableActions={lookups.allActions ?? []}
              actionsLoading={lookups.allActionsLoading}
              actionsError={lookups.allActionsLoadFailed}
              availableUsers={lookups.availableUsers ?? []}
              usersLoading={lookups.usersLoading}
              usersError={lookups.usersError}
              activeContractUserIds={lookups.activeContractUserIds}
              onboarding={form.onboarding ?? false}
            />
            <OpenReferenceWarning
              actionId={task?.id}
              expression={cohortExpression}
              prerequisiteActionIds={prerequisites}
              memberActionStart={dateOrNull(task?.memberActionStart)}
              memberActionDeadline={dateOrNull(task?.memberActionDeadline)}
              actions={lookups.allActions ?? []}
            />
          </FieldGroup>
        </>
      )}
      <CheckboxField
        name="onboarding"
        label="Onboarding"
        help="Members with a contract can complete it only if they signed their first one after its Members taking action event starts."
        checked={form.onboarding ?? false}
        onChange={editor.handleInputChange}
      />
    </FormSection>
  );
}
