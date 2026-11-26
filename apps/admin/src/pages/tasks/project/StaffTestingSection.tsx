import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { ActionPhase } from "../../../lib/actionPhase";
import {
  ActionEditorSection,
  missingForStaffTesting,
} from "../../../lib/staffTestingGate";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../../ui/Button";
import PhaseBadge from "../../../ui/PhaseBadge";
import { cn } from "../../../ui/cn";
import { linkClass } from "../../../ui/styles";
import { SidePanelSection } from "../../../ui/templates/Record";
import type { TaskRecordContext } from "../TaskRecord";
import type { TaskTab } from "../taskTabs";

const REQUIREMENT_TAB: Record<ActionEditorSection, TaskTab> = {
  [ActionEditorSection.Details]: "details",
  [ActionEditorSection.TaskForm]: "form",
  [ActionEditorSection.Release]: "events",
};

/**
 * Starts and stops staff testing, the only way a project task's draft is
 * shown to staff. Staff are members: while it is on, every staff account sees
 * the draft as members would (`server/src/actions/staff-preview.ts`).
 */
export function StaffTestingSection({
  action,
  phase,
  context,
}: {
  action: ParsedActionDto;
  phase: ActionPhase;
  context: TaskRecordContext;
}) {
  const confirm = useConfirmOnPage();
  const missing = missingForStaffTesting(action);
  const blocked = missing.length > 0;
  const { unsaved, busy, setStaffPreview, openTab } = context;

  const start = async () => {
    const ok = await confirm({
      title: "Start staff testing?",
      message:
        "Every staff account will see this draft. Nothing they enter is submitted.",
      confirmLabel: "Start staff testing",
      cancelLabel: "Cancel",
    });
    if (ok) await setStaffPreview(true);
  };

  let control: React.ReactNode = null;
  switch (phase) {
    case ActionPhase.Draft:
      control = (
        <Button
          variant={ButtonVariant.Default}
          onClick={() => void start()}
          disabled={busy || unsaved || blocked}
        >
          Start staff testing…
        </Button>
      );
      break;
    case ActionPhase.StaffTesting:
      control = (
        <Button
          variant={ButtonVariant.Default}
          onClick={() => void setStaffPreview(false)}
          disabled={busy || unsaved}
        >
          Stop staff testing
        </Button>
      );
      break;
    case ActionPhase.Scheduled:
    case ActionPhase.Live:
    case ActionPhase.Closed:
      break;
    default:
      throw new Error(`unknown phase: ${phase satisfies never}`);
  }

  return (
    <SidePanelSection title="Staff testing">
      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge status={action.status} />
        {control}
      </div>
      {unsaved && control && (
        <p className="text-caption text-warning">Save your changes first</p>
      )}
      {phase === ActionPhase.Draft && blocked && (
        <p className="text-caption text-fg-muted">
          Needed before staff testing:{" "}
          {missing.map((requirement, index) => (
            <span key={requirement.id}>
              {index > 0 && ", "}
              <button
                type="button"
                className={cn(linkClass, "inline")}
                onClick={() => openTab(REQUIREMENT_TAB[requirement.section])}
              >
                {requirement.label}
              </button>
            </span>
          ))}
        </p>
      )}
    </SidePanelSection>
  );
}
