import type { ActionCategory } from "@alliance/shared/client";
import {
  ACTION_CATEGORY_LABELS,
  sortActionCategories,
} from "@alliance/shared/lib/actionCategory";
import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";
import { hasViewerCompletedAction } from "@alliance/shared/lib/actionUtils";
import { clipboardCopy } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { ACTION_CATEGORY_ICONS } from "@alliance/sharedweb/lib/actionCategory";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Link2Icon, Workflow } from "lucide-react";
import React, { useCallback } from "react";
import { Link, href } from "react-router";
import { actionShareUrl } from "../lib/actionShare";
import ActionCompletedBarWithInfo from "../pages/app/ActionCompletedBarWithInfo";
import ShareButton from "./ShareButton";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  className?: string;
}

const ActionCategoryGutter: React.FC<{
  categories: readonly ActionCategory[];
}> = ({ categories }) => {
  const sorted = sortActionCategories(categories);
  const labels = sorted.map((category) => ACTION_CATEGORY_LABELS[category]);
  const Icon =
    sorted.length === 1 ? ACTION_CATEGORY_ICONS[sorted[0]] : Workflow;
  return (
    <div className="flex w-8 md:w-11 shrink-0 items-center justify-center text-zinc-500 opacity-70 transition-opacity group-hover/card:opacity-100">
      {sorted.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={<span role="img" aria-label={labels.join(", ")} />}
            className={cn("relative inline-flex", zIndex.raised)}
          >
            <Icon size={15} />
          </TooltipTrigger>
          <TooltipContent className="flex flex-col">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  className,
  friendCommitmentActivities,
}) => {
  const shouldShowCompletedBar = showCompletedBar(action);

  const handleShareAction = useCallback(async () => {
    const url = await actionShareUrl({
      actionId: action.id,
      isAuthenticated: true,
    });
    return copyToClipboard(url);
  }, [action.id]);

  return (
    <div
      className={cn(
        "group/card relative flex flex-row border-1 border-zinc-200 rounded-[7px] hover:bg-white/50",
        className,
      )}
    >
      <ActionCategoryGutter categories={action.category} />
      <div className="flex-1 min-w-0 py-3 pr-3 md:py-4 md:pr-4">
        <div className="flex flex-row gap-x-3 md:gap-x-4">
          <div className="flex flex-col justify-between flex-1">
            <div className="flex flex-row items-start gap-x-8">
              <div className="flex-1 flex flex-col">
                <div className="flex flex-row items-center justify-between gap-x-2">
                  <Link
                    to={href("/actions/:id", { id: action.id.toString() })}
                    className="font-medium text-black after:absolute after:inset-0"
                  >
                    {action.name}
                  </Link>
                  <div className="flex flex-row items-center gap-x-2">
                    <ShareButton
                      onClick={handleShareAction}
                      icon={Link2Icon}
                      label={clipboardCopy.copyLink}
                      copiedLabel={clipboardCopy.copiedToClipboard}
                      className={cn(
                        "relative text-zinc-500 hover:text-zinc-700",
                        zIndex.raised,
                      )}
                      iconClassName="h-4 w-4 shrink-0"
                      iconOnly
                    />
                    {hasViewerCompletedAction(action) && (
                      <CheckIcon size={20} />
                    )}
                  </div>
                </div>
                <p className="text-zinc-500">{action.shortDescription}</p>
              </div>
            </div>
          </div>
        </div>
        {shouldShowCompletedBar && (
          <ActionCompletedBarWithInfo
            action={action}
            friendActivities={friendCommitmentActivities ?? null}
            className="mt-4"
            barRounded="rounded-[3px]"
            barClassName="inset-shadow-sm"
            barFillClassName="shadow-[0_0_4px] shadow-green/50 transition-shadow group-hover/card:shadow-[0_0_7px] group-hover/card:shadow-green/40"
            dark
          />
        )}
      </div>
    </div>
  );
};

export default ActionItemCard;
