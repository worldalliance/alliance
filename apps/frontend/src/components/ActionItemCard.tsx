import React, { useCallback } from "react";
import { Link, href } from "react-router";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";
import { cn } from "@alliance/shared/styles/util";
import ShareButton from "./ShareButton";
import { ExternalLinkIcon } from "lucide-react";
import { clipboardCopy } from "@alliance/shared/lib/copy";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { useAuth } from "../lib/AuthContext";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  className?: string;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  className,
  friendCommitmentActivities,
}) => {
  const { user } = useAuth();
  const shouldShowCompletedBar = showCompletedBar(action);

  const handleShareAction = useCallback(() => {
    const ref = user?.referralCode ? `?ref=${user.referralCode}` : "";
    const url = `${getBaseUrl()}/actions/${action.id}${ref}`;
    return navigator.clipboard.writeText(url);
  }, [action.id, user?.referralCode]);

  return (
    <div className={cn("relative p-3 md:p-4 hover:bg-zinc-50", className)}>
      <Link
        to={href("/actions/:id", { id: action.id.toString() })}
        className="block"
      >
        <div className="flex flex-row gap-x-3 md:gap-x-4">
          {/* <ActionSquareThumbnail
            imgSrc={action.squareThumbnailImage}
            imgAlt={action.squareThumbnailImageAlt}
            size="smallDynamic"
          /> */}
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
