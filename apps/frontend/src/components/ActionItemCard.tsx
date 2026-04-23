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
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { buildActionShareUrl } from "@alliance/shared/lib/shareText";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  className?: string;
}

function getStageMeta(status: ActionItemCardPropsShared["action"]["status"]) {
  switch (status) {
    case "planned":
      return {
        label: "Planned",
        className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
      };
    case "office_action":
      return {
        label: "Pending office action",
        className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      };
    case "member_action":
      return {
        label: "Members taking action",
        className: "bg-green/10 text-green-900 ring-1 ring-green/20",
      };
    case "resolution":
      return {
        label: "Office reviewing results",
        className: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
      };
    case "completed":
      return {
        label: "Action completed",
        className: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200",
      };
    case "failed":
      return {
        label: "Action failed",
        className: "bg-red-50 text-red-700 ring-1 ring-red-200",
      };
    case "abandoned":
      return {
        label: "Action abandoned",
        className: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
      };
    case "draft":
    default:
      return {
        label: "Draft",
        className: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
      };
  }
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  className,
  friendCommitmentActivities,
}) => {
  const shouldShowCompletedBar = showCompletedBar(action);
  const stage = getStageMeta(action.status);

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
          {/* <ActionSquareThumbnail
            imgSrc={action.squareThumbnailImage}
            imgAlt={action.squareThumbnailImageAlt}
            size="smallDynamic"
          /> */}
          <div className="flex flex-col justify-between flex-1">
            <div className="flex flex-row items-start gap-x-8">
              <div className="flex-1 flex flex-col">
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-black">{action.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        stage.className,
                      )}
                    >
                      {stage.label}
                    </span>
                    <span className="flex w-5 justify-center">
                      {action.userRelation === "completed" && (
                        <CheckIcon size={20} />
                      )}
                    </span>
                  </div>
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
