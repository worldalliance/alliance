import {
  WITHDRAWAL_OPTION_LABELS,
  type WithdrawalOption,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
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

const WITHDRAWAL_OPTION_TEXT_STYLE: Record<WithdrawalOption, string> = {
  out_of_time: "text-orange-600",
  moral: "text-amber-600",
  doesnt_apply: "text-sky-600",
  other: "text-zinc-700",
};

type StoredWithdrawal = {
  outOfTime?: boolean | null;
  isMoral?: boolean | null;
  doesntApply?: boolean | null;
  declineReason?: string | null;
};

export const WithdrawalDetails: React.FC<{ withdrawal: StoredWithdrawal }> = ({
  withdrawal,
}) => {
  const option = withdrawalOptionFromFlags(withdrawal);
  return (
    <>
      <span className={WITHDRAWAL_OPTION_TEXT_STYLE[option]}>
        {WITHDRAWAL_OPTION_LABELS[option]}
      </span>
      {withdrawal.declineReason && (
        <span className="text-zinc-500">{withdrawal.declineReason}</span>
      )}
    </>
  );
};

export const WithdrawalInfo: React.FC<{
  withdrawal: StoredWithdrawal;
  trigger?: React.ReactElement;
}> = ({
  withdrawal,
  trigger = <WithdrawalBadge className="whitespace-nowrap cursor-default" />,
}) => (
  <HoverCard>
    <HoverCardTrigger render={trigger} />
    <HoverCardContent>
      <div className="flex flex-col items-center gap-0.5">
        <WithdrawalDetails withdrawal={withdrawal} />
      </div>
    </HoverCardContent>
  </HoverCard>
);
