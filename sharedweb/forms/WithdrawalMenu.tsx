import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { withdrawalOptions } from "@alliance/shared/lib/copy";
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
import BaseButton, { BaseButtonVariant } from "../ui/BaseButton";
import Modal, { ModalBody, ModalHeader, ModalTitle } from "../ui/Modal";

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
  renderTrigger?: (show: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");
  const navigate = useNavigate();

  const show = () => setOpen(true);

  const toggleWithdrawalOption = (option: WithdrawalOption) => {
    setWithdrawalOption((previous) => (previous === option ? null : option));
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(show)
      ) : (
        <BaseButton onClick={show}>
          <Ellipsis size={15} />
        </BaseButton>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        panelClassName="max-w-sm"
      >
        <ModalHeader className="pl-14">
          <ModalTitle className="text-center">{withdrawalOptions}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-y-2 *:w-full">
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
                  onClick={() => {
                    setOpen(false);
                    navigate("/membership#away-periods");
                  }}
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
                  setOpen(false);
                }}
                disabled={
                  disabled ||
                  !canSubmitWithdrawal(withdrawalOption, customReason)
                }
              >
                Withdraw
              </BaseButton>
            </>
          )}
        </ModalBody>
      </Modal>
    </>
  );
}
