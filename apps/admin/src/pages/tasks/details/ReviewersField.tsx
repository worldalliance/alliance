import { useRef } from "react";
import { makeTempId } from "../../../lib/tempId";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { FieldGroup } from "../../../ui/templates/Form";
import { useFocusAfterRemoval } from "../../../ui/useFocusAfterRemoval";
import {
  changeReviewerUrl,
  chooseReviewerIcon,
  detectedIconLabel,
  REVIEWER_ICON_LABELS,
  reviewerIconChoice,
  type ReviewerRow,
} from "./reviewerRows";

export function ReviewersField({
  reviewers,
  onChange,
}: {
  reviewers: ReviewerRow[];
  onChange: (reviewers: ReviewerRow[]) => void;
}) {
  const update = (key: string, change: (row: ReviewerRow) => ReviewerRow) =>
    onChange(reviewers.map((row) => (row.key === key ? change(row) : row)));
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useFocusAfterRemoval({
    ids: reviewers.map((row) => row.key),
    fallback: addRef,
  });
  return (
    <FieldGroup
      label="Reviewed by"
      help="People outside the Alliance shown as “Reviewed by” on the task page. A link is optional: a website, LinkedIn or similar."
    >
      {reviewers.map((reviewer, index) => {
        const who = reviewer.name.trim() || `reviewer ${index + 1}`;
        return (
          <div
            key={reviewer.key}
            {...focus.row(reviewer.key)}
            className="flex items-center gap-2"
          >
            <Input
              value={reviewer.name}
              placeholder="Name"
              aria-label={`Name of reviewer ${index + 1}`}
              onChange={(e) =>
                update(reviewer.key, (row) => ({
                  ...row,
                  name: e.target.value,
                }))
              }
              className="min-w-0 flex-1"
            />
            <Input
              value={reviewer.url ?? ""}
              placeholder="Link (optional)"
              aria-label={`Link for ${who}`}
              onChange={(e) =>
                update(reviewer.key, (row) =>
                  changeReviewerUrl(row, e.target.value),
                )
              }
              className="min-w-0 flex-1"
            />
            <Select
              value={reviewerIconChoice(reviewer)}
              aria-label={`Icon for ${who}`}
              onChange={(e) =>
                update(reviewer.key, (row) =>
                  chooseReviewerIcon(row, e.target.value),
                )
              }
              className="w-auto"
            >
              <option value="auto">
                Icon: Auto ({detectedIconLabel(reviewer.url)})
              </option>
              <option value="none">Icon: None</option>
              {Object.entries(REVIEWER_ICON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  Icon: {label}
                </option>
              ))}
            </Select>
            <Button
              variant={ButtonVariant.Ghost}
              aria-label={`Remove: ${who}`}
              onClick={() => {
                focus.removing(reviewer.key)();
                onChange(reviewers.filter((row) => row.key !== reviewer.key));
              }}
            >
              Remove
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          ref={addRef}
          variant={ButtonVariant.Default}
          size="small"
          onClick={() =>
            onChange([...reviewers, { key: makeTempId(), name: "" }])
          }
        >
          Add reviewer
        </Button>
      </div>
    </FieldGroup>
  );
}
