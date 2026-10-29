import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { cn } from "@alliance/shared/styles/util";
import { RefreshCw, Undo2, X } from "lucide-react";
import { useState } from "react";
import {
  EditActionLink,
  EditTaskFormLink,
  iconControlClass,
} from "./ActionLinks";
import {
  findingContext,
  TEXT_SOURCE_LABELS,
  type TextFinding,
} from "./actionTextFindings";
import { LaunchSection } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import { TEXT_ISSUE_LABELS } from "./textChecks";
import type { LaunchAction } from "./useSuiteLaunchData";

const FindingRow = ({
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
}) => {
  const place = (finding: TextFinding) =>
    `${actionsById.get(finding.actionId)?.name} · ${TEXT_SOURCE_LABELS[finding.source]}`;
  return (
    <li
      className={cn(
        "flex items-start gap-2 py-2",
        dismissed && "text-zinc-400",
      )}
    >
      <div className="flex flex-1 flex-col gap-1 text-sm">
        <p className="text-xs text-zinc-500">
          {TEXT_ISSUE_LABELS[group[0].kind]} ·{" "}
          {group.length === 1 ? place(group[0]) : `${group.length} places`}
        </p>
        {group.map((finding) => {
          const { before, flagged, after } = findingContext(finding);
          return (
            <div key={finding.key} className="flex items-center gap-2">
              <p className="flex-1 whitespace-pre-wrap font-mono text-xs">
                {group.length > 1 && (
                  <span className="mr-2 font-sans text-zinc-500">
                    {place(finding)}
                  </span>
                )}
                …{before}
                <mark className={dismissed ? "bg-zinc-100" : "bg-yellow-200"}>
                  {flagged.replaceAll(" ", "·")}
                </mark>
                {after}…
              </p>
              {finding.formId ? (
                <EditTaskFormLink formId={finding.formId} />
              ) : (
                <EditActionLink actionId={finding.actionId} />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-label={dismissed ? "Restore" : "Dismiss"}
        title={dismissed ? "Restore" : "Dismiss"}
        className={iconControlClass}
      >
        {dismissed ? <Undo2 className="size-4" /> : <X className="size-4" />}
      </button>
    </li>
  );
};

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

const TextFindingsCheck = ({
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
}) => {
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
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        Fix the text in the action, then re-run the checks.
        <button
          type="button"
          onClick={onRecheck}
          aria-label="Re-run checks"
          title="Re-run checks"
          className={iconControlClass}
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
      <ul className="divide-y divide-zinc-100">
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
        <button
          type="button"
          onClick={() => setShowDismissed(!showDismissed)}
          className="self-start text-xs text-zinc-500 underline"
        >
          {showDismissed ? "Hide dismissed" : "Show dismissed"}
        </button>
      )}
      {showDismissed && (
        <ul className="divide-y divide-zinc-100">
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
};

export default TextFindingsCheck;
