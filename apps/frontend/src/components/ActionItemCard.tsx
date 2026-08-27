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
import { ExternalLinkIcon } from "lucide-react";
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
    <div className={cn("relative p-3 md:p-4 hover:bg-zinc-50", className)}>
      <Link
        to={href("/actions/:id", { id: action.id.toString() })}
        className="block"
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
      {shouldShowCompletedBar && (
        <ActionCompletedBarWithInfo
          action={action}
          friendActivities={friendCommitmentActivities ?? null}
          className="mt-4"
          labelAction={
            <ShareButton
              onClick={handleShareAction}
              icon={ExternalLinkIcon}
              label={clipboardCopy.share}
              copiedLabel={clipboardCopy.copiedToClipboard}
              className="rounded text-zinc-500 hover:text-zinc-700"
              iconClassName="h-3.5 w-3.5 shrink-0"
              labelClassName="text-sm"
            />
          }
        />
      )}
      {!shouldShowCompletedBar && (
        <div className="mt-4 flex justify-start">
          <ShareButton
            onClick={handleShareAction}
            icon={ExternalLinkIcon}
            label={clipboardCopy.share}
            copiedLabel={clipboardCopy.copiedToClipboard}
            className="rounded text-zinc-500 hover:text-zinc-700"
            iconClassName="h-3.5 w-3.5 shrink-0"
            labelClassName="text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default ActionItemCard;
