import {
  WITHDRAWAL_OPTION_LABELS,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
import React from "react";
import Badge from "../ui/Badge";
import { cn } from "../ui/cn";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../ui/HoverCard";

export const WithdrawalBadge: React.FC<{ className?: string }> = ({
  className,
}) => <Badge className={cn("self-auto", className)}>Withdrew</Badge>;

type StoredWithdrawal = {
  outOfTime?: boolean | null;
  isMoral?: boolean | null;
  declineReason?: string | null;
};

/** The option the member picked, then the reason they typed, as two spans for the caller to lay out. */
export const WithdrawalDetails: React.FC<{ withdrawal: StoredWithdrawal }> = ({
  withdrawal,
}) => (
  <>
    <span className="font-medium text-fg">
      {WITHDRAWAL_OPTION_LABELS[withdrawalOptionFromFlags(withdrawal)]}
    </span>
    {withdrawal.declineReason && (
      <span className="text-fg-muted">{withdrawal.declineReason}</span>
    )}
  </>
);

const withdrawalSummary = (withdrawal: StoredWithdrawal): string =>
  [
    WITHDRAWAL_OPTION_LABELS[withdrawalOptionFromFlags(withdrawal)],
    withdrawal.declineReason,
  ]
    .filter(Boolean)
    .join(": ");

export const WithdrawalInfo: React.FC<{
  withdrawal: StoredWithdrawal;
  trigger?: React.ReactElement;
}> = ({ withdrawal, trigger }) => (
  <HoverCard>
    <HoverCardTrigger
      render={
        trigger ?? (
          <span
            tabIndex={0}
            className="inline-flex cursor-default rounded-full focus-ring"
          >
            <WithdrawalBadge />
            <span className="sr-only">: {withdrawalSummary(withdrawal)}</span>
          </span>
        )
      }
    />
    <HoverCardContent>
      <div className="flex max-w-xs flex-col gap-0.5 wrap-break-word">
        <WithdrawalDetails withdrawal={withdrawal} />
      </div>
    </HoverCardContent>
  </HoverCard>
);
