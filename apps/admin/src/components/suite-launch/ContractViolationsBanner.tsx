import { OctagonAlert } from "lucide-react";
import { LaunchSection } from "./launchBlockers";

const ContractViolationsBanner = ({
  violations,
  acknowledged,
  onAcknowledgedChange,
}: {
  violations: string[];
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) => (
  <div
    id={LaunchSection.Contract}
    role="alert"
    className="flex scroll-mt-4 flex-col gap-2 rounded-lg border-2 border-red-600 bg-red-50 p-4 text-red-800"
  >
    <h3 className="flex items-center gap-2 text-lg font-bold">
      <OctagonAlert className="size-6" />
      This launch breaks the member contract
    </h3>
    <ul className="list-disc pl-6 text-sm font-medium">
      {violations.map((violation) => (
        <li key={violation}>{violation}</li>
      ))}
    </ul>
    <label className="flex items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={acknowledged}
        onChange={(e) => onAcknowledgedChange(e.target.checked)}
      />
      Launch anyway, breaking the contract
    </label>
  </div>
);

export default ContractViolationsBanner;
