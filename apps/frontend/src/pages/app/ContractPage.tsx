import { userSignContract, userSuspendContract } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import React, { useEffect, useState } from "react";
import MemberContract from "../../components/MemberContract";
import FormInput from "@alliance/shared/ui/FormInput";
import { useAuth } from "../../lib/AuthContext";
import CenterLayout from "@alliance/shared/ui/CenterLayout";

const ContractPage: React.FC = () => {
  const { user, loading } = useAuth();

  const [contractDateSigned, setContractDateSigned] = useState<Date | null>();
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (user) {
      setContractDateSigned(
        user.contractDateSigned && !user.contractDateSuspended
          ? new Date(user.contractDateSigned)
          : null
      );
    }
  }, [user]);

  const handleContractSign = async () => {
    try {
      const res = await userSignContract();
      if (res.data) {
        setContractDateSigned(new Date(res.data));
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

      await userSuspendContract();
      setContractDateSigned(null);
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
        <p className="font-serif text-3xl md:text-4xl font-medium mb-1">
          Contract
        </p>
        <p className="text-zinc-900 mb-4">
          Below is your membership contract.
          <ul className="list-disc list-inside mt-2">
            <li>We will post any updates to your contract here.</li>
            <li>You can terminate your membership at any time.</li>
          </ul>
        </p>
        <MemberContract />

        {!contractDateSigned && (
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
        {contractDateSigned && (
          <div className="mt-4 flex flex-col gap-y-2 sm:flex-row justify-between sm:items-center">
            <p className="text-green">
              You signed this contract on{" "}
              {new Date(contractDateSigned).toLocaleDateString()}.
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
