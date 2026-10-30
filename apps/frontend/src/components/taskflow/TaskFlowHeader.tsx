import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import WithdrawalMenu from "@alliance/sharedweb/forms/WithdrawalMenu";
import { Ellipsis, X } from "lucide-react";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { FLOW_COLUMN } from "./TaskFlowScreen";

export type FlowWithdrawHandler = (
  withdrawal: Omit<ActionWithdrawal, "partialFormData">,
) => void;

export function TaskFlowWithdrawMenu({
  disabled,
  onWithdraw,
}: {
  disabled: boolean;
  onWithdraw: FlowWithdrawHandler;
}) {
  return (
    <WithdrawalMenu
      disabled={disabled}
      onWithdraw={onWithdraw}
      renderTrigger={(toggle) => (
        <FlowButton
          kind={FlowButtonKind.Icon}
          onClick={toggle}
          aria-label={withdrawFromAction}
        >
          <Ellipsis size={20} aria-hidden />
        </FlowButton>
      )}
    />
  );
}

export default function TaskFlowHeader({
  onClose,
  disabled,
  progressSaved,
  onWithdraw,
}: {
  onClose: () => void;
  disabled: boolean;
  progressSaved: boolean;
  onWithdraw: FlowWithdrawHandler | null;
}) {
  return (
    <div className={cn(FLOW_COLUMN, "flex items-center justify-between py-3")}>
      <div className="flex items-center gap-x-3">
        <FlowButton
          kind={FlowButtonKind.Icon}
          onClick={onClose}
          disabled={disabled}
          aria-label={taskFlow.closeTask}
        >
          <X size={20} aria-hidden />
        </FlowButton>
        {progressSaved ? (
          <p className="text-sm text-zinc-500">{taskFlow.progressSaved}</p>
        ) : null}
      </div>
      {onWithdraw ? (
        <TaskFlowWithdrawMenu disabled={disabled} onWithdraw={onWithdraw} />
      ) : null}
    </div>
  );
}
