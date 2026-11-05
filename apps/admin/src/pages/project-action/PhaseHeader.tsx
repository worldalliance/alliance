import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ActionPhasePill from "../../components/ActionPhasePill";
import { ActionPhase } from "../../lib/actionPhase";
import { missingForStaffTesting } from "../../lib/staffTestingGate";

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
  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <ActionPhasePill phase={phase} status={action.status} />
        {phase === ActionPhase.Draft && (
          <Button
            color={ButtonColor.Black}
            onClick={() => onStaffPreviewChange(true)}
            disabled={busy || unsaved || missing.length > 0}
          >
            Start staff testing
          </Button>
        )}
        {phase === ActionPhase.StaffTesting && (
          <Button
            color={ButtonColor.White}
            onClick={() => onStaffPreviewChange(false)}
            disabled={busy || unsaved}
          >
            Stop staff testing
          </Button>
        )}
        {unsaved && (
          <span className="text-sm text-amber-700">
            Save your changes first
          </span>
        )}
      </div>
      {phase === ActionPhase.Draft && missing.length > 0 && (
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
