import type { ActionWithdrawalDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@alliance/sharedweb/ui/HoverCard";
import React from "react";

export const WithdrawalBadge: React.FC<{ className?: string }> = ({
  className,
}) => (
  <span
    className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800",
      className,
    )}
  >
    Withdrew
  </span>
);

export const WithdrawalInfo: React.FC<{ withdrawal: ActionWithdrawalDto }> = ({
  withdrawal,
}) => {
  const hasDetails =
    withdrawal.outOfTime || withdrawal.isMoral || withdrawal.declineReason;

  if (!hasDetails) {
    return <WithdrawalBadge className="whitespace-nowrap" />;
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <WithdrawalBadge className="whitespace-nowrap cursor-default" />
        }
      />
      <HoverCardContent>
        <div className="flex flex-col items-center gap-0.5">
          {withdrawal.outOfTime && (
            <span className="text-orange-600">Out of time</span>
          )}
          {withdrawal.isMoral && (
            <span className="text-amber-600">Moral objection</span>
          )}
          {withdrawal.declineReason && (
            <span className="text-zinc-500">{withdrawal.declineReason}</span>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
