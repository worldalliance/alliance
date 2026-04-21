import { ActionDto } from "@alliance/shared/client";
import Button from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import ConfettiWrapper from "@alliance/sharedweb/ui/ConfettiWrapper";
import { CardStyle } from "@alliance/shared/styles/card";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";
import { guestReferral } from "@alliance/shared/lib/copy";

interface ActionTaskPanelActivityProps {
  action: ActionDto;
  onCompleteAction: () => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  createAccountHref?: string;
}

const ActionTaskPanelActivity = ({
  action,
  onCompleteAction,
  disabled = false,
  createAccountHref,
}: ActionTaskPanelActivityProps) => {
  return (
    <Card style={CardStyle.White}>
      <div className="flex flex-col gap-y-2">
        <p className="font-medium text-lg mb-1">
          Complete this action by following these steps
        </p>
        <div className="">
          <p className="text-lg font-semibold">Steps</p>
          <ReactMarkdown>{action.taskContents}</ReactMarkdown>
        </div>
        <div className="flex justify-end">
          {createAccountHref && !disabled ? (
            <Link
              to={createAccountHref}
              className="inline-flex items-center rounded-full bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
            >
              {guestReferral.createAccountToSubmit}
            </Link>
          ) : (
            <ConfettiWrapper
              disabled={disabled}
              onTrigger={onCompleteAction}
              burstPlacement="local"
            >
              {({ disabled: confettiDisabled, onClick, onKeyDown, onPointerDown }) => (
                <Button
                  onClick={onClick}
                  onKeyDown={onKeyDown}
                  onPointerDown={onPointerDown}
                  disabled={confettiDisabled}
                >
                  {disabled ? "Completed" : "Mark Complete"}
                </Button>
              )}
            </ConfettiWrapper>
          )}
        </div>
      </div>
    </Card>
  );
};

export default ActionTaskPanelActivity;
