import { RefreshCw, X } from "lucide-react";
import { EditActionLink, iconControlClass } from "./ActionLinks";
import {
  findingContext,
  TEXT_SOURCE_LABELS,
  type TextFinding,
} from "./actionTextFindings";
import LaunchCheck from "./LaunchCheck";
import { TEXT_ISSUE_LABELS } from "./textChecks";
import type { LaunchAction } from "./useSuiteLaunchData";

const TextFindingsCheck = ({
  findings,
  actions,
  dismissedKeys,
  onDismiss,
  onRecheck,
}: {
  findings: TextFinding[];
  actions: LaunchAction[];
  dismissedKeys: ReadonlySet<string>;
  onDismiss: (key: string) => void;
  onRecheck: () => void;
}) => {
  const open = findings.filter((finding) => !dismissedKeys.has(finding.key));
  const actionNames = new Map(
    actions.map(({ action }) => [action.id, action.name]),
  );
  return (
    <LaunchCheck
      title="Spelling and grammar"
      passed={open.length === 0}
      summary={`${open.length} to fix or dismiss · ${findings.length - open.length} dismissed`}
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
        {open.map((finding) => {
          const { before, flagged, after } = findingContext(finding);
          return (
            <li key={finding.key} className="flex items-center gap-2 py-2">
              <div className="flex-1 text-sm">
                <p className="text-xs text-zinc-500">
                  {TEXT_ISSUE_LABELS[finding.kind]} ·{" "}
                  {actionNames.get(finding.actionId)} ·{" "}
                  {TEXT_SOURCE_LABELS[finding.source]}
                </p>
                <p className="whitespace-pre-wrap font-mono text-xs">
                  …{before}
                  <mark className="bg-yellow-200">
                    {flagged.replaceAll(" ", "·")}
                  </mark>
                  {after}…
                </p>
              </div>
              <EditActionLink actionId={finding.actionId} />
              <button
                type="button"
                onClick={() => onDismiss(finding.key)}
                aria-label="Dismiss"
                title="Dismiss"
                className={iconControlClass}
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};

export default TextFindingsCheck;
