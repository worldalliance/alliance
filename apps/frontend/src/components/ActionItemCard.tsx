import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";
import { clipboardCopy } from "@alliance/shared/lib/copy";
import { buildActionShareUrl } from "@alliance/shared/lib/shareText";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { Link2Icon } from "lucide-react";
import React, { useCallback } from "react";
import { Link, href } from "react-router";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import ShareButton from "./ShareButton";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  className?: string;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  className,
  friendCommitmentActivities,
}) => {
  const shouldShowCompletedBar = showCompletedBar(action);

  const handleShareAction = useCallback(async () => {
    const url = await buildActionShareUrl({
      actionId: action.id,
      baseUrl: getBaseUrl(),
      isAuthenticated: true,
    });
    return copyToClipboard(url);
  }, [action.id]);

  return (
    <div
      className={cn(
        "relative p-3 md:p-4 border-1 border-zinc-200 rounded-[7px] hover:bg-white/50",
        className,
      )}
    >
      <Link
        to={href("/actions/:id", { id: action.id.toString() })}
        className="block after:absolute after:inset-0"
      >
        <div className="flex flex-row gap-x-3 md:gap-x-4">
          <div className="flex flex-col justify-between flex-1">
            <div className="flex flex-row items-start gap-x-8">
              <div className="flex-1 flex flex-col">
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <p className="font-medium text-black">{action.name}</p>
                  {action.userRelation === "completed" && (
                    <CheckIcon size={20} />
                  )}
                </div>
                <p className="text-zinc-500">{action.shortDescription}</p>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <div className="mt-4 flex flex-row items-end justify-end gap-x-4">
        {shouldShowCompletedBar && (
          <ActionCompletedBarWithInfo
            action={action}
            friendActivities={friendCommitmentActivities ?? null}
            className="flex-1"
          />
        )}
        <ShareButton
          onClick={handleShareAction}
          icon={Link2Icon}
          label={clipboardCopy.copyLink}
          copiedLabel={clipboardCopy.copiedToClipboard}
          className="relative z-10 text-zinc-500 hover:text-zinc-700"
          iconClassName="h-4 w-4 shrink-0"
          iconOnly
        />
      </div>
    </div>
  );
};

export default ActionItemCard;
