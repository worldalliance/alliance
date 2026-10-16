import { urlMatchesDomain } from "@alliance/common/url";
import { ActionReviewerDto, ActionReviewerIcon } from "@alliance/shared/client";
import React from "react";
import { makeTempId } from "../lib/tempId";

/** Reviewer row being edited; `key` is a client-only React key, never sent to the server. */
export type ReviewerRow = ActionReviewerDto & { key: string };

/**
 * Frontend-only "auto" icon detection: infers the reviewer icon from the
 * link. The backend only stores the resolved icon, never "auto".
 */
const detectReviewerIcon = (
  url: string | undefined,
): ActionReviewerIcon | undefined =>
  url && urlMatchesDomain(url, "linkedin.com") ? "linkedin" : undefined;

const REVIEWER_ICON_LABELS: Record<ActionReviewerIcon, string> = {
  linkedin: "LinkedIn",
};

/**
 * The select shows "Auto" whenever the stored icon matches what detection
 * would pick anyway, so an explicit choice only sticks when it differs.
 */
const reviewerIconSelectValue = (reviewer: ActionReviewerDto): string => {
  if (reviewer.icon === detectReviewerIcon(reviewer.url)) return "auto";
  return reviewer.icon ?? "none";
};

const applyReviewerIconSelection = (
  reviewer: ReviewerRow,
  selection: string,
): ReviewerRow => ({
  ...reviewer,
  icon:
    selection === "auto"
      ? detectReviewerIcon(reviewer.url)
      : selection === "none"
        ? undefined
        : (selection as ActionReviewerIcon),
});

interface ActionReviewersEditorProps {
  reviewers: ReviewerRow[];
  onReviewersChange: (reviewers: ReviewerRow[]) => void;
}

const ActionReviewersEditor: React.FC<ActionReviewersEditorProps> = ({
  reviewers,
  onReviewersChange,
}) => (
  <div>
    <p className="text-sm font-medium text-gray-700">Reviewed By</p>
    <p className="text-xs text-gray-500 mt-0.5 mb-2">
      External reviewers (not members) shown as “Reviewed by” on the action
      page. Link is optional (website, LinkedIn, …).
    </p>
    <div className="space-y-2">
      {reviewers.map((reviewer) => (
        <div key={reviewer.key} className="flex gap-2">
          <input
            type="text"
            value={reviewer.name}
            placeholder="Name"
            onChange={(e) =>
              onReviewersChange(
                reviewers.map((r) =>
                  r.key === reviewer.key ? { ...r, name: e.target.value } : r,
                ),
              )
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
          <input
            type="text"
            value={reviewer.url ?? ""}
            placeholder="Link (optional)"
            onChange={(e) =>
              onReviewersChange(
                reviewers.map((r) => {
                  if (r.key !== reviewer.key) return r;
                  // In auto mode, keep the icon tracking the link.
                  const wasAuto = r.icon === detectReviewerIcon(r.url);
                  const url = e.target.value;
                  return {
                    ...r,
                    url,
                    icon: wasAuto ? detectReviewerIcon(url) : r.icon,
                  };
                }),
              )
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
          <select
            value={reviewerIconSelectValue(reviewer)}
            onChange={(e) =>
              onReviewersChange(
                reviewers.map((r) =>
                  r.key === reviewer.key
                    ? applyReviewerIconSelection(r, e.target.value)
                    : r,
                ),
              )
            }
            className="px-2 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="auto">
              Icon: Auto
              {(() => {
                const detected = detectReviewerIcon(reviewer.url);
                return detected
                  ? ` (${REVIEWER_ICON_LABELS[detected]})`
                  : " (none)";
              })()}
            </option>
            <option value="none">Icon: None</option>
            {Object.entries(REVIEWER_ICON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                Icon: {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              onReviewersChange(reviewers.filter((r) => r.key !== reviewer.key))
            }
            className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onReviewersChange([...reviewers, { key: makeTempId(), name: "" }])
        }
        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        + Add reviewer
      </button>
    </div>
  </div>
);

export default ActionReviewersEditor;
