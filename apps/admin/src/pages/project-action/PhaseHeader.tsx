import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Link } from "react-router";
import { ActionPhase } from "../../lib/actionPhase";
import {
  editorShowsStaffPreview,
  missingForStaffTesting,
} from "../../lib/staffTestingGate";
import { actionSectionPath } from "../action-dashboard/workspaceLocation";

type StaffPreviewToggle = {
  staffPreview: boolean;
  label: string;
  color: ButtonColor;
};

const STOP_STAFF_TESTING: StaffPreviewToggle = {
  staffPreview: false,
  label: "Stop staff testing",
  color: ButtonColor.White,
};

const STAFF_PREVIEW_TOGGLE: Record<ActionPhase, StaffPreviewToggle | null> = {
  [ActionPhase.Draft]: {
    staffPreview: true,
    label: "Start staff testing",
    color: ButtonColor.Black,
  },
  [ActionPhase.StaffTesting]: STOP_STAFF_TESTING,
  [ActionPhase.Scheduled]: null,
  [ActionPhase.Live]: null,
  [ActionPhase.Closed]: null,
};

export const UnsavedNotice = () => (
  <p className="text-sm text-amber-700">Save your changes on Content first</p>
);

const PhaseHeader = ({
  action,
  phase,
  unsaved,
  busy,
  onStaffPreviewChange,
}: {
  action: ParsedActionDto;
  phase: ActionPhase;
  unsaved: boolean;
  busy: boolean;
  onStaffPreviewChange: (staffPreview: boolean) => void;
}) => {
  const missing = editorShowsStaffPreview(action, phase)
    ? []
    : missingForStaffTesting(action);
  // A project action closed before launch has no editor checkbox, so this is the only way to end its staff preview.
  const toggle =
    phase === ActionPhase.Closed &&
    action.staffPreview &&
    !hasMemberActionStarted(action.events, new Date())
      ? STOP_STAFF_TESTING
      : STAFF_PREVIEW_TOGGLE[phase];
  const blocked = toggle?.staffPreview === true && missing.length > 0;
  if (!toggle) return null;
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          color={toggle.color}
          onClick={() => onStaffPreviewChange(toggle.staffPreview)}
          disabled={busy || unsaved || blocked}
        >
          {toggle.label}
        </Button>
        {unsaved && <UnsavedNotice />}
      </div>
      {blocked && (
        <p className="text-sm text-zinc-600">
          Needed before staff testing:{" "}
          {missing.map((requirement, index) => (
            <span key={requirement.id}>
              {index > 0 && ", "}
              <Link
                to={actionSectionPath(action.id, requirement.section)}
                className="text-blue-600 underline"
              >
                {requirement.label}
              </Link>
            </span>
          ))}
        </p>
      )}
    </div>
  );
};

export default PhaseHeader;
