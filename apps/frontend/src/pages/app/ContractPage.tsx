import {
  ContractEvent,
  userSignContract,
  userSuspendContract,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import React, { useEffect, useState } from "react";
import MemberContract from "../../components/MemberContract";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useAuth } from "../../lib/AuthContext";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";

const ContractPage: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();

  const [editName, setEditName] = useState("");

  const [lastContractEvent, setLastContractEvent] = useState<Pick<
    ContractEvent,
    "type" | "date" | "automatic"
  > | null>(null);

  useEffect(() => {
    if (user) {
      setLastContractEvent(
        user.contractEvents?.length
          ? user.contractEvents?.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]
          : null
      );
    }
  }, [user]);

  const handleContractSign = async () => {
    try {
      const res = await userSignContract();
      if (res.data) {
        setLastContractEvent({
          type: "signed",
          date: res.data,
          automatic: false,
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
      if (!window.confirm("Are you sure you want to suspend your contract?")) {
        return;
      }

      const res = await userSuspendContract();
      if (res.data) {
        setLastContractEvent({
          type: "suspended",
          date: res.data,
          automatic: false,
        });
        await refreshUser();
      }
    } catch (error) {
      console.error("Error suspending contract:", error);
      alert("There was an error suspending the contract. Please try again.");
    }
  };

  if (!user && !loading) {
    return <div>Not found</div>;
  }

  return (
    <CenterLayout>
      <div className="mt-4 md:mt-8 gap-y-2 flex flex-col text-base md:text-lg">
        <p className="font-serif text-3xl md:text-4xl font-semibold mb-1">
          Membership contract
        </p>
        <p className="text-zinc-900">Notes:</p>
        <ul className="text-zinc-900 mb-4 list-disc list-inside">
          <li>You can terminate your membership at any time.</li>
          <li>
            If you miss 3 or more of the last 10 tasks you were assigned, your
            contract will be suspended automatically. You can re-sign the
            contract to re-join the Alliance.
          </li>
        </ul>
        {lastContractEvent?.type === "suspended" && (
          <Card style={CardStyle.Red}>
            <p>
              {lastContractEvent.automatic
                ? "Your contract was suspended automatically on "
                : "You suspended your contract on "}
              {new Date(lastContractEvent.date).toLocaleDateString()}.
            </p>
          </Card>
        )}
        <MemberContract />

        {lastContractEvent?.type !== "signed" && (
          <div className="flex flex-row mt-2 w-full">
            <FormInput
              name="name"
              type="text"
              placeholder="Type your full name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleContractSign}
              color={ButtonColor.Black}
              className="ml-2 !h-auto px-6"
            >
              Sign
            </Button>
          </div>
        )}
        {lastContractEvent?.type === "signed" && (
          <div className="mt-4 flex flex-col gap-y-2 sm:flex-row justify-between sm:items-center">
            <p className="text-green">
              You signed this contract on{" "}
              {new Date(lastContractEvent.date).toLocaleDateString()}.
            </p>
            <Button onClick={handleContractSuspend} color={ButtonColor.Red}>
              Suspend contract
            </Button>
          </div>
        )}
      </div>
    </CenterLayout>
  );
};

export default ContractPage;
