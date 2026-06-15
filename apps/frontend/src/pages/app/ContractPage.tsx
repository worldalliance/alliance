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
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import MemberContract from "../../components/MemberContract";
import { useAuth } from "../../lib/AuthContext";
import { useContract } from "../../lib/useContract";

const WEEKLY_COMMITMENT_CONFIRMATION =
  "I understand that the Alliance relies on my 15-minute contribution every single week. I commit to complete each task to the best of my ability.";

const normalizeConfirmation = (confirmation: string) =>
  confirmation.trim().toLocaleLowerCase();

const ContractPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { latestContract } = useContract();
  const [editName, setEditName] = useState("");
  const [weeklyCommitmentConfirmation, setWeeklyCommitmentConfirmation] =
    useState("");
  const [lastContractEvent, setLastContractEvent] =
    useState<ContractEventState>(null);
  const weeklyCommitmentConfirmed =
    normalizeConfirmation(weeklyCommitmentConfirmation) ===
    normalizeConfirmation(WEEKLY_COMMITMENT_CONFIRMATION);

  const signedContractId =
    lastContractEvent?.contractId !== undefined &&
    lastContractEvent.contractId !== latestContract?.id
      ? lastContractEvent.contractId
      : null;
  const { data: signedContract } = useQuery({
    queryKey: ["contractGetById", signedContractId],
    queryFn: () =>
      contractGetById({
        path: { id: signedContractId! },
      }).then((res) => res.data ?? null),
    initialData: null,
    enabled: signedContractId != null,
  });

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      setLastContractEvent(getLastContractEvent(user.contractEvents));
    }
  }, [user]);

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
        });
        await refreshUser();
      }
    } catch (error) {
      console.error("Error suspending contract:", error);
      alert("There was an error suspending the contract. Please try again.");
    }
  };

  const signedContractMessage = useMemo(() => {
    if (!lastContractEvent) {
      return null;
    }

    return (
      <div className="mt-4 flex flex-col gap-y-2 sm:flex-row justify-between sm:items-center">
        <p className="text-green">{getSignedMessage(lastContractEvent.date)}</p>
      </div>
    );
  }, [lastContractEvent]);

  return (
    <CenterLayout>
      <div className="gap-y-8 flex flex-col text-base md:text-lg">
        <h1 className="text-title">Membership contract</h1>

        <section className="flex flex-col gap-y-4">
          {signedContract && (
            <div className="flex flex-col">
              <MemberContract
                markdownOverride={signedContract.markdown}
                className="p-6"
              />
              {signedContractMessage}
            </div>
          )}

          {latestContract && (
            <div className="flex flex-col gap-y-4">
              {signedContract && (
                <p className="font-semibold">
                  An updated contract is available.
                </p>
              )}
              <MemberContract
                markdownOverride={latestContract.markdown}
                className="p-6"
              />
              {lastContractEvent?.type === "signed" &&
              lastContractEvent.contractId === latestContract.id ? (
                signedContractMessage
              ) : (
                <Card
                  style={CardStyle.LightGreyBorder}
                  className="gap-y-4 p-5 sm:p-6"
                >
                  <div className="flex flex-col gap-y-1">
                    <h2 className="text-xl md:text-2xl font-semibold text-black">
                      Confirm your commitment
                    </h2>
                    <p className="text-sm font-medium text-zinc-700">
                      Before signing, please type the statement below to confirm
                      that you understand the weekly commitment.
                    </p>
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <p className="rounded border border-l-4 border-zinc-200 border-l-green bg-white/70 px-4 py-3 text-[16px] italic text-zinc-800">
                      {WEEKLY_COMMITMENT_CONFIRMATION}
                    </p>
                    <textarea
                      name="weeklyCommitmentConfirmation"
                      aria-label="Weekly commitment confirmation"
                      value={weeklyCommitmentConfirmation}
                      onChange={(e) =>
                        setWeeklyCommitmentConfirmation(e.target.value)
                      }
                      onPaste={(e) => e.preventDefault()}
                      placeholder="Type the statement here"
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
                        className="!h-auto px-6 sm:ml-2"
                      >
                        Sign
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </section>

        <section className="text-[16px]">
          <Card
            style={CardStyle.LightGreyBorder}
            className="gap-y-5 p-5 sm:p-6"
          >
            <div className="flex flex-col gap-y-2">
              <h2 className="text-xl md:text-2xl font-semibold text-black">
                Questions about membership
              </h2>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
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
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                What happens if I don’t follow the contract?
              </h3>
              <p className="text-base">
                If you miss 3 or more of the last 10 tasks you were assigned,
                your contract will be suspended automatically. You can re-sign
                the contract to re-join the Alliance.
              </p>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                Are there valid reasons to miss an action?
              </h3>
              <p className="text-base">
                Yes. For our planning purposes, we ask that you inform us if you
                will be unable to complete an action with one of the following
                methods:
              </p>
              <ol className="list-decimal list-inside pl-4 space-y-1">
                <li className="text-base">
                  You can withdraw from an action by tapping the three dots at
                  the bottom right of an action, next to the Complete button.
                  You can withdraw if the action is taking you longer than 15
                  minutes to complete, or if you have a moral objection to the
                  action.
                </li>
                <li className="text-base">
                  You can mark yourself as away in Settings if you won&apos;t be
                  able to complete an action for a prolonged period, such as
                  during a vacation.
                </li>
              </ol>
            </div>
            <div className="flex flex-col gap-y-1">
              <h3 className="flex items-center gap-x-2 font-semibold text-black">
                <span className="h-1.5 w-1.5 rounded-full bg-green" />
                How do I end my membership?
              </h3>
              <p className="text-base">
                You can end your membership at any time by suspending your
                contract on this page.
              </p>
              {lastContractEvent?.type === "signed" && (
                <Button
                  onClick={handleContractSuspend}
                  color={ButtonColor.Red}
                  className="mt-4"
                >
                  Suspend contract
                </Button>
              )}
              {lastContractEvent?.type === "suspended" && (
                <Card style={CardStyle.Red} className="mt-4 text-base">
                  <p>
                    {getSuspensionMessage(
                      lastContractEvent.date,
                      lastContractEvent.automatic,
                    )}
                  </p>
                </Card>
              )}
            </div>
          </Card>
        </section>
      </div>
    </CenterLayout>
  );
};

export default ContractPage;
