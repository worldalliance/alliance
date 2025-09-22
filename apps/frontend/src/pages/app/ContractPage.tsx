import { userSignContract, userSuspendContract } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import React, { useEffect, useState } from "react";
import MemberContract from "../../components/MemberContract";
import FormInput from "../../components/system/FormInput";
import { useAuth } from "../../lib/AuthContext";

const ContractPage: React.FC = () => {
  const { user } = useAuth();

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
    if (editName.trim().toLowerCase() !== user?.name.toLowerCase()) {
      alert(
        "Please enter your name exactly as you have set it on your profile."
      );
      return;
    }

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

  if (!user) {
    return <div>Not found</div>;
  }

  return (
    <div className="flex flex-col bg-white items-center min-h-[calc(100vh-var(--nav-height))]">
      <div className="flex flex-col max-w-3xl mx-auto p-3 mt-4 md:pt-20">
        <div className="gap-y-2 flex flex-col text-base md:text-lg">
          <p className="font-serif text-3xl md:text-4xl font-semibold mb-1">
            Contract
          </p>
          <p className="text-zinc-900 mb-4">
            Below is your membership contract. This page is also where we will
            post updates to the contract, and where you can terminate your
            membership if you choose to do so.
          </p>
          <MemberContract />

          {!contractDateSigned && (
            <div className="flex flex-row mt-2 w-full">
              <FormInput
                name="name"
                type="text"
                placeholder={user.name}
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
            <div className="mt-4 flex flex-row justify-between items-center">
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
      </div>
    </div>
  );
};

export default ContractPage;
