import {
  ContractEventType,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import {
  CONTRACT_STATUS_LABEL,
  contractStatus,
} from "@alliance/shared/lib/contract";
import { cn } from "@alliance/shared/styles/util";
import { CONTRACT_STATUS_TEXT_CLASS } from "../../lib/contractStatusStyle";
import Section from "../ui/Section";

const EVENT_ROW_CLASS: Record<ContractEventType, string> = {
  signed: "bg-green-50 text-green-700",
  suspended: "bg-red-50 text-red-700",
};

export default function UserContractSection({
  user,
}: {
  user: UserAdminDetailDto;
}) {
  const status = contractStatus(user.lastContractEvent);
  const events = [...(user.contractEvents ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return (
    <Section
      title="Contract"
      actions={
        <span
          className={cn(
            "text-sm font-medium",
            CONTRACT_STATUS_TEXT_CLASS[status],
          )}
        >
          {CONTRACT_STATUS_LABEL[status]}
        </span>
      }
    >
      {events.length > 0 ? (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {events.map((event, idx) => (
            <div
              key={idx}
              className={cn(
                "text-xs flex items-center justify-between px-2 py-1 rounded-md",
                EVENT_ROW_CLASS[event.type],
              )}
            >
              <span className="font-medium capitalize">{event.type}</span>
              <span className="text-zinc-500">
                {new Date(event.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No contract events.</p>
      )}
    </Section>
  );
}
