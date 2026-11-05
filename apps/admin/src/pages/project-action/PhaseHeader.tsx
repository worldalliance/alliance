import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ActionPhasePill from "../../components/ActionPhasePill";
import { ActionPhase } from "../../lib/actionPhase";
import { missingForStaffTesting } from "../../lib/staffTestingGate";

type StaffPreviewToggle = {
  staffPreview: boolean;
  label: string;
  color: ButtonColor;
};

const STAFF_PREVIEW_TOGGLE: Record<ActionPhase, StaffPreviewToggle | null> = {
  [ActionPhase.Draft]: {
    staffPreview: true,
    label: "Start staff testing",
    color: ButtonColor.Black,
  },
  [ActionPhase.StaffTesting]: {
    staffPreview: false,
    label: "Stop staff testing",
    color: ButtonColor.White,
  },
  [ActionPhase.Scheduled]: null,
  [ActionPhase.Live]: null,
  [ActionPhase.Closed]: null,
};

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
  const missing = missingForStaffTesting(action);
  const toggle = STAFF_PREVIEW_TOGGLE[phase];
  const blocked = toggle?.staffPreview === true && missing.length > 0;
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <ActionPhasePill phase={phase} status={action.status} />
        {toggle && (
          <Button
            color={toggle.color}
            onClick={() => onStaffPreviewChange(toggle.staffPreview)}
            disabled={busy || unsaved || blocked}
          >
            {toggle.label}
          </Button>
        )}
        {unsaved && (
          <span className="text-sm text-amber-700">
            Save your changes first
          </span>
        )}
      </div>
      {blocked && (
        <p className="text-sm text-zinc-600">
          Needed before staff testing:{" "}
          {missing.map((requirement, index) => (
            <span key={requirement.id}>
              {index > 0 && ", "}
              <a
                href={`#${requirement.section}`}
                className="text-blue-600 underline"
              >
                {requirement.label}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
};

export default PhaseHeader;
