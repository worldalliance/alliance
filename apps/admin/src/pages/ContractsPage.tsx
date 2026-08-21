import {
  ContractAdminDto,
  contractAllAdmin,
  contractGetCurrent,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import ContractCard from "../components/ContractCard";

const ContractsPage: React.FC = () => {
  const [contracts, setContracts] = useState<ContractAdminDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data: currentContract } = useQuery({
    queryKey: ["contractGetCurrent"],
    queryFn: () => contractGetCurrent().then((res) => res.data ?? null),
  });
  const activeContractId = currentContract?.id ?? null;

  const loadContracts = useCallback(async () => {
    try {
      const response = await contractAllAdmin();
      if (response.data) {
        setContracts(response.data);
      }
      setLoading(false);
    } catch (err) {
      setError("Failed to load contracts");
      setLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const { activeContract, scheduledContracts, inactiveContracts } =
    useMemo(() => {
      const now = new Date();
      let activeContract: ContractAdminDto | null = null;
      const scheduledContracts: ContractAdminDto[] = [];
      const inactiveContracts: ContractAdminDto[] = [];

      contracts.forEach((c) => {
        if (c.id === activeContractId) {
          activeContract = c;
        } else if (c.startDate && new Date(c.startDate) > now) {
          scheduledContracts.push(c);
        } else {
          inactiveContracts.push(c);
        }
      });

      scheduledContracts.sort(
        (a, b) =>
          new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime(),
      );

      return {
        activeContract,
        scheduledContracts,
        inactiveContracts,
      };
    }, [contracts, activeContractId]);

  if (loading) {
    return <p className="p-5">Loading contracts...</p>;
  }

  if (error) {
    return <p className="p-5 text-red-500">{error}</p>;
  }

  const groups = [
    ...(activeContract ? [{ label: "Active", items: [activeContract] }] : []),
    { label: "Scheduled", items: scheduledContracts },
    { label: "Inactive", items: inactiveContracts },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4 p-5">
      <title>Contracts - Admin</title>
      <div className="flex items-center gap-x-2">
        <p className="font-bold text-lg">Contracts</p>
        <Button
          onClick={() => navigate("/contracts/new")}
          className="hover:bg-green-2 text-white !px-3 !py-1 rounded-md text-sm"
          color={ButtonColor.Green}
        >
          New Contract
        </Button>
      </div>
      <p className="text-sm text-zinc-500">
        {contracts.length} total contract{contracts.length !== 1 ? "s" : ""}
      </p>

      {contracts.length === 0 ? (
        <p className="text-zinc-500">No contracts found.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-x-2 mb-2">
                <div className="h-px bg-zinc-300 flex-1" />
                <p className="text-xs font-bold uppercase text-zinc-700">
                  {group.label}
                </p>
                <div className="h-px bg-zinc-300 flex-1" />
              </div>
              <div className="border border-zinc-200 rounded-lg overflow-hidden divide-y divide-zinc-200">
                {group.items.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    navigate={navigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContractsPage;
