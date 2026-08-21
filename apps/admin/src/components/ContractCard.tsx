import { useNavigate } from "react-router";

const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export type ContractCardContract = {
  id: number;
  name?: string | null;
  createdAt: string;
  markdown: string;
  startDate?: string | null;
  endDate?: string | null;
};

export interface ContractCardProps {
  contract: ContractCardContract;
  navigate: ReturnType<typeof useNavigate>;
}

const ContractCard = ({ contract, navigate }: ContractCardProps) => {
  const preview =
    contract.markdown.slice(0, 80) + (contract.markdown.length > 80 ? "…" : "");
  return (
    <div
      className="p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
      onClick={() => navigate(`/contracts/${contract.id}`)}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-y-1">
          <h2 className="font-bold text-sm">
            {contract.name?.trim() || `Contract #${contract.id}`}
          </h2>
          <p className="text-xs text-zinc-600 line-clamp-2">{preview}</p>
          <div className="flex items-center gap-x-3 text-xs text-zinc-500">
            <span>Start: {formatDate(contract.startDate)}</span>
            <span>End: {formatDate(contract.endDate)}</span>
            <span>Created: {formatDate(contract.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractCard;
