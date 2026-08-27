import {
  contractGetById,
  contractSignContract,
  contractSuspendContract,
} from "@alliance/shared/client";
import {
  ContractEventState,
  getLastContractEvent,
  getSignedMessage,
  getSuspensionMessage,
} from "@alliance/shared/lib/contract";
import { suspendContractConfirmation } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useId, useMemo, useState } from "react";
import { useLocation } from "react-router";
import AwayRangesSection from "../../components/AwayRangesSection";
import { useAuth } from "../../lib/AuthContext";
import { useContract } from "../../lib/useContract";

const WEEKLY_COMMITMENT_CONFIRMATION =
  "I commit to complete each task to the best of my ability.";

const COMMITMENT_CONFIRMATION_LENGTH_TOLERANCE = 10;

function FormalTextDropdown({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        Full text
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div
        id={contentId}
        hidden={!open}
        className="rounded bg-zinc-50 p-4 text-sm text-zinc-700"
      >
        <AppMarkdownWrapper markdownContent={markdown} />
      </div>
    </div>
  );
}

function ContractDescriptionList({
  items,
  markdown,
  children,
}: {
  items?: { point: string; subtext: string }[];
  markdown: string;
  children?: React.ReactNode;
}) {
  if (!items?.length && markdown.trim() === "" && !children) return null;
  return (
    <div className="flex flex-col gap-y-5">
      {items && items.length > 0 && (
        <ol className="flex flex-col gap-y-5 list-none pl-0">
          {items.map((item, index) => (
            <li key={index} className="flex gap-x-4">
              <span className="shrink-0 size-8 md:size-9 flex items-center justify-center rounded bg-black text-white text-lg md:text-xl font-semibold leading-none tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex flex-col">
                <div className="font-semibold">
                  <AppMarkdownWrapper markdownContent={item.point} />
                </div>
                {item.subtext.trim() !== "" && (
                  <div className="">
                    <AppMarkdownWrapper markdownContent={item.subtext} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {markdown.trim() !== "" && <FormalTextDropdown markdown={markdown} />}
      {children}
    </div>
  );
}

function SignedContractActions({
  message,
  onSuspend,
}: {
  message: React.ReactNode;
  onSuspend: () => void;
}) {
  return (
    <div className="flex flex-col gap-y-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-200 pt-5">
      {message}
      <Button onClick={onSuspend} color={ButtonColor.Red}>
        Suspend contract
      </Button>
    </div>
  );
}

const isConfirmationLengthCloseEnough = (confirmation: string) =>
  Math.abs(
    confirmation.trim().length - WEEKLY_COMMITMENT_CONFIRMATION.length,
  ) <= COMMITMENT_CONFIRMATION_LENGTH_TOLERANCE;

const MembershipPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { latestContract } = useContract();
  const queryClient = useQueryClient();
  const { hash } = useLocation();
  const [editName, setEditName] = useState("");
  const [weeklyCommitmentConfirmation, setWeeklyCommitmentConfirmation] =
    useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const weeklyCommitmentConfirmed = isConfirmationLengthCloseEnough(
    weeklyCommitmentConfirmation,
  );

  const previousSignedContractId =
    typeof lastContractEvent?.contractId === "number" &&
    lastContractEvent.contractId !== latestContract?.id
      ? lastContractEvent.contractId
      : null;
  const { data: previousSignedContract } = useQuery({
    queryKey: ["contractGetById", previousSignedContractId],
    queryFn: () =>
      contractGetById({
        path: { id: previousSignedContractId! },
      }).then((res) => res.data ?? null),
    initialData: null,
    enabled: previousSignedContractId != null,
  }); // if the member has signed the latest contract, this will be null

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      setLastContractEvent(getLastContractEvent(user.contractEvents));
    }
  }, [user]);

  useEffect(() => {
    if (!hash) {
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [hash]);

  const handleContractSign = async () => {
    if (!latestContract || !weeklyCommitmentConfirmed) {
      return;
    }
    try {
      const res = await contractSignContract({
        path: {
          id: latestContract.id,
        },
        body: { signedName: editName },
      });
      if (res.data) {
        setLastContractEvent({
          type: "signed",
          date: res.data.date,
          automatic: false,
          contractId: latestContract.id,
        });
        setWeeklyCommitmentConfirmation("");
        void queryClient.invalidateQueries({
          queryKey: queryKeys.myVisibilityContext(),
        });
        await refreshUser();
      }
    } catch (error) {
      console.error("Error signing contract:", error);
      alert("There was an error signing the contract. Please try again.");
    }
  };

  const handleContractSuspend = async () => {
    try {
      if (!window.confirm(suspendContractConfirmation)) {
        return;
      }

      const res = await contractSuspendContract();
      if (res.data) {
        setLastContractEvent({
          type: "suspended",
          date: res.data.date,
          automatic: false,
          contractId: null,
        });
        await refreshUser();
      }
    } catch (error) {
      console.error("Error suspending contract:", error);
      alert("There was an error suspending the contract. Please try again.");
    }
  };

  const signedDateMessage = useMemo(() => {
    if (!lastContractEvent) {
      return null;
    }

    return (
      <p className="text-green">{getSignedMessage(lastContractEvent.date)}</p>
    );
  }, [lastContractEvent]);

  return (
    <CenterLayout>
      <div className="mb-6 relative flex flex-col gap-y-6">
        <h1 className="text-title">Membership</h1>

        {(previousSignedContract || latestContract) && (
          <Card style={CardStyle.White} className="p-6">
            <h2 className="font-semibold! text-2xl! mb-4">Contract</h2>
            <div className="flex flex-col gap-y-4">
              {previousSignedContract && (
                <ContractDescriptionList
                  items={previousSignedContract.description}
                  markdown={previousSignedContract.markdown}
                >
                  {lastContractEvent?.type === "signed" && (
                    <SignedContractActions
                      message={signedDateMessage}
                      onSuspend={handleContractSuspend}
                    />
                  )}
                </ContractDescriptionList>
              )}

              {latestContract && (
                <>
                  {previousSignedContract && (
                    <p className="font-semibold">
                      An updated contract is available.
                    </p>
                  )}
                  <ContractDescriptionList
                    items={latestContract.description}
                    markdown={latestContract.markdown}
                  >
                    {lastContractEvent?.type === "signed" &&
                    lastContractEvent.contractId === latestContract.id ? (
                      <SignedContractActions
                        message={signedDateMessage}
                        onSuspend={handleContractSuspend}
                      />
                    ) : (
                      <div className="flex flex-col gap-y-4 border-zinc-200 border-t pt-5">
                        <h3 className="font-semibold">Signing</h3>
                        <div className="flex flex-col gap-y-2">
                          <p className="rounded border border-l-4 border-zinc-200 border-l-green bg-zinc-50 px-4 py-3 italic text-zinc-800">
                            {WEEKLY_COMMITMENT_CONFIRMATION}
                          </p>
                          <textarea
                            name="weeklyCommitmentConfirmation"
                            aria-label="Weekly commitment confirmation"
                            value={weeklyCommitmentConfirmation}
                            onChange={(e) =>
                              setWeeklyCommitmentConfirmation(e.target.value)
                            }
                            placeholder="Type the above statement here"
                            rows={2}
                            className="resize-y rounded border border-zinc-200 bg-white px-3 py-3 text-[11pt] transition-all duration-200 hover:border-zinc-300 focus:border-green focus:outline-none"
                          />
                          <div className="flex flex-col gap-y-3 sm:flex-row">
                            <FormInput
                              name="name"
                              type="text"
                              placeholder="Type your full name"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              disabled={!editName || !weeklyCommitmentConfirmed}
                              onClick={handleContractSign}
                              color={ButtonColor.Black}
                              className="h-auto! px-6 sm:ml-2"
                            >
                              Sign
                            </Button>
                          </div>
                          {lastContractEvent?.type === "suspended" && (
                            <Card style={CardStyle.Red} className="text-base">
                              <p>
                                {getSuspensionMessage(
                                  lastContractEvent.date,
                                  lastContractEvent.automatic,
                                )}
                              </p>
                            </Card>
                          )}
                        </div>
                      </div>
                    )}
                  </ContractDescriptionList>
                </>
              )}
            </div>
          </Card>
        )}

        <Card
          id="away-periods"
          style={CardStyle.White}
          className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
        >
          <AwayRangesSection />
        </Card>

        <Card style={CardStyle.White} className="p-6">
          <h2 className="font-semibold! text-2xl! mb-4">
            Questions about membership
          </h2>
          <div className="flex flex-col gap-y-5">
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                Why is there a contract?
              </h3>
              <p className="text-base">
                The contract ensures that we can count on your participation,
                which allows us to plan actions precisely. By signing, you are
                also making a commitment to your peers to work together
                consistently.
              </p>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                What happens if I don&apos;t follow the contract?
              </h3>
              <p className="text-base">
                If you miss all assigned non-optional actions for 3 weeks in a
                row, your contract will be suspended automatically. You can
                re-sign the contract to re-join the Alliance.
              </p>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                Are there valid reasons to miss an action?
              </h3>
              <p className="text-base">
                Yes. For our planning purposes, we ask that you inform us if you
                will be unable to complete an action with one of the following
                methods:
              </p>
              <ol className="list-decimal list-outside pl-4 space-y-1">
                <li className="text-base">
                  You can withdraw from an action by tapping the three dots at
                  the bottom right of an action, next to the Complete button.
                  You can withdraw if the action is taking you longer than 15
                  minutes to complete, or if you have a moral objection to the
                  action.
                </li>
                <li className="text-base">
                  You can schedule an away period on this page if you won&apos;t
                  be able to complete actions for a prolonged period, such as
                  during a vacation.
                </li>
              </ol>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                How do I end my membership?
              </h3>
              <p className="text-base">
                You can end your membership at any time by suspending your
                contract on this page.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </CenterLayout>
  );
};

export default MembershipPage;
