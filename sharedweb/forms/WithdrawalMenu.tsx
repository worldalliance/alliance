import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { cn } from "@alliance/shared/styles/util";
import {
  CircleDashed,
  Clock,
  Ellipsis,
  Scale,
  TreePalm,
  type LucideIcon,
} from "lucide-react";
import React, { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useOutsideClick } from "../lib/useOutsideClick";
import BaseButton, { BaseButtonVariant } from "../ui/BaseButton";
import Dropdown from "../ui/Dropdown";

const WITHDRAWAL_OPTION_ICONS: Record<WithdrawalOption, LucideIcon> = {
  out_of_time: Clock,
  moral: Scale,
  other: CircleDashed,
};

export default function WithdrawalMenu({
  disabled,
  onWithdraw,
  renderTrigger,
}: {
  disabled: boolean;
  onWithdraw: (choice: Omit<ActionWithdrawal, "partialFormData">) => void;
  renderTrigger?: (toggle: () => void) => ReactNode;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");
  const ref = useOutsideClick(() => setDropdownOpen(false));
  const navigate = useNavigate();

  const toggle = () => setDropdownOpen(!dropdownOpen);

  const toggleWithdrawalOption = (option: WithdrawalOption) => {
    setWithdrawalOption((previous) => (previous === option ? null : option));
  };

  return (
    <div className="relative" ref={ref}>
      {renderTrigger ? (
        renderTrigger(toggle)
      ) : (
        <BaseButton onClick={toggle}>
          <Ellipsis size={15} />
        </BaseButton>
      )}
      <Dropdown
        isOpen={dropdownOpen}
        className="absolute top-[100%] right-0 gap-y-2 *:w-full w-[300px]"
      >
        <p className="mb-1 text-center">Withdrawal options</p>
        {WITHDRAWAL_OPTIONS.map((option) => (
          <React.Fragment key={option}>
            <BaseButton
              className={cn(
                "justify-start",
                withdrawalOption === option && "bg-zinc-100",
              )}
              iconLeft={WITHDRAWAL_OPTION_ICONS[option]}
              onClick={() => toggleWithdrawalOption(option)}
            >
              {WITHDRAWAL_OPTION_LABELS[option]}
            </BaseButton>
            {option === "moral" && (
              <BaseButton
                className="justify-start"
                iconLeft={TreePalm}
                onClick={() => navigate("/membership#away-periods")}
              >
                On vacation
              </BaseButton>
            )}
          </React.Fragment>
        ))}
        {withdrawalOption !== null && (
          <>
            <textarea
              className="w-full h-20 border border-gray-300 rounded-md px-3 py-2 bg-white"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Explain in more detail..."
            />
            <BaseButton
              variant={BaseButtonVariant.Black}
              onClick={() => {
                onWithdraw({
                  ...withdrawalFlagsFromOption(withdrawalOption),
                  reason: customReason.trim(),
                });
                setDropdownOpen(false);
              }}
              disabled={
                disabled || !canSubmitWithdrawal(withdrawalOption, customReason)
              }
            >
              Withdraw
            </BaseButton>
          </>
        )}
      </Dropdown>
    </div>
  );
}
