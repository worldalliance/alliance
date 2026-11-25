import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useState } from "react";
import {
  TEXT_SOURCE_LABELS,
  TextSource,
  type TextFinding,
} from "../../../components/suite-launch/actionTextFindings";
import { LaunchSection } from "../../../components/suite-launch/launchBlockers";
import { TEXT_ISSUE_LABELS } from "../../../components/suite-launch/textChecks";
import type { LaunchAction } from "../../../components/suite-launch/useSuiteLaunchData";
import { LinkedField } from "../../../lib/linkedSelection";
import { textContext } from "../../../lib/textContext";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { LaunchCheck } from "./LaunchCheck";
import { EditTaskFormLink, EditTaskLink } from "./TaskLinks";

const SOURCE_FIELDS: Record<TextSource, LinkedField | null> = {
  [TextSource.Name]: LinkedField.Name,
  [TextSource.ShortDescription]: LinkedField.ShortDescription,
  [TextSource.Body]: LinkedField.Body,
  [TextSource.TaskForm]: null,
  [TextSource.VariantForm]: null,
};

function Excerpt({
  finding,
  place,
  dismissed,
}: {
  finding: TextFinding;
  place: string | null;
  dismissed: boolean;
}) {
  const { before, flagged, after, cutBefore, cutAfter } = textContext(finding);
  const field = SOURCE_FIELDS[finding.source];
  return (
    <div className="flex items-baseline gap-3">
      <p className="min-w-0 flex-1 whitespace-pre-wrap">
        {place && <span className="mr-2 text-fg-muted">{place}</span>}
        {cutBefore && "…"}
        {before}
        <mark
          className={cn(
            "rounded-sm px-0.5 text-fg",
            dismissed ? "bg-surface-2" : "bg-warning-soft",
          )}
        >
          {flagged.replaceAll(" ", "·")}
        </mark>
        {after}
        {cutAfter && "…"}
      </p>
      <span className="shrink-0 text-caption">
        {finding.formId ? (
          <EditTaskFormLink
            formId={finding.formId}
            elementId={finding.formElementId}
          />
        ) : (
          <EditTaskLink
            actionId={finding.actionId}
            select={
              field
                ? { field, from: finding.start, to: finding.end, text: flagged }
                : undefined
            }
          />
        )}
      </span>
    </div>
  );
}

function FindingRow({
  group,
  actionsById,
  dismissed,
  onToggle,
}: {
  /** Every finding sharing a dismissal, as every instance of one misspelling. */
  group: TextFinding[];
  actionsById: ReadonlyMap<number, ParsedActionDto>;
  dismissed: boolean;
  onToggle: () => void;
}) {
  const place = (finding: TextFinding) =>
    `${actionsById.get(finding.actionId)?.name} · ${TEXT_SOURCE_LABELS[finding.source]}`;
  return (
    <li
      className={cn(
        "flex items-start gap-3 px-card py-3",
        dismissed && "text-fg-muted",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-caption font-medium text-fg-muted">
          {TEXT_ISSUE_LABELS[group[0].kind]} ·{" "}
          {group.length === 1 ? place(group[0]) : `${group.length} places`}
        </p>
        {group.map((finding) => (
          <Excerpt
            key={finding.key}
            finding={finding}
            place={group.length > 1 ? place(finding) : null}
            dismissed={dismissed}
          />
        ))}
      </div>
      <Button size="small" variant={ButtonVariant.Default} onClick={onToggle}>
        {dismissed ? "Restore" : "Dismiss"}
      </Button>
    </li>
  );
}

const byDismissKey = (findings: TextFinding[]) => {
  const groups = new Map<string, TextFinding[]>();
  for (const finding of findings) {
    groups.set(finding.dismissKey, [
      ...(groups.get(finding.dismissKey) ?? []),
      finding,
    ]);
  }
  return [...groups.values()];
};

/** Spelling and spacing in the tasks' text: each fixed or dismissed. */
export function TextCheck({
  findings,
  actions,
  dismissedKeys,
  onDismiss,
  onRestore,
  onRecheck,
}: {
  findings: TextFinding[];
  actions: LaunchAction[];
  dismissedKeys: ReadonlySet<string>;
  onDismiss: (key: string) => void;
  onRestore: (key: string) => void;
  onRecheck: () => void;
}) {
  const [showDismissed, setShowDismissed] = useState(false);
  const open = byDismissKey(
    findings.filter((finding) => !dismissedKeys.has(finding.dismissKey)),
  );
  const dismissed = byDismissKey(
    findings.filter((finding) => dismissedKeys.has(finding.dismissKey)),
  );
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  return (
    <LaunchCheck
      id={LaunchSection.Text}
      title="Spelling and grammar"
      passed={open.length === 0}
      summary={`${open.length} to fix or dismiss · ${dismissed.length} dismissed`}
      flush
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-card py-3">
        <p className="text-fg-muted">
          Fix the text in {actions.length === 1 ? "the task" : "the tasks"},
          then re-run the checks.
        </p>
        <Button size="small" variant={ButtonVariant.Default} onClick={onRecheck}>
          Re-run checks
        </Button>
      </div>
      {open.length === 0 && (
        <p className="px-card py-3 text-fg-muted">Nothing left to fix.</p>
      )}
      <ul className="divide-y divide-line">
        {open.map((group) => (
          <FindingRow
            key={group[0].dismissKey}
            group={group}
            actionsById={actionsById}
            dismissed={false}
            onToggle={() => onDismiss(group[0].dismissKey)}
          />
        ))}
      </ul>
      {dismissed.length > 0 && (
        <div className="border-t border-line px-card py-3">
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            aria-expanded={showDismissed}
            onClick={() => setShowDismissed(!showDismissed)}
          >
            {showDismissed ? "Hide dismissed" : "Show dismissed"}
          </Button>
        </div>
      )}
      {showDismissed && (
        <ul className="divide-y divide-line border-t border-line">
          {dismissed.map((group) => (
            <FindingRow
              key={group[0].dismissKey}
              group={group}
              actionsById={actionsById}
              dismissed
              onToggle={() => onRestore(group[0].dismissKey)}
            />
          ))}
        </ul>
      )}
    </LaunchCheck>
  );
}
