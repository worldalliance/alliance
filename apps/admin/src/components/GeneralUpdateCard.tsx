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

/** Minimal shape for display; compatible with GeneralUpdateAdminDto and suite.generalUpdates */
export type GeneralUpdateCardUpdate = {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  suites?: Array<{ name: string }>;
};

export interface GeneralUpdateCardProps {
  update: GeneralUpdateCardUpdate;
  navigate: ReturnType<typeof useNavigate>;
}

const GeneralUpdateCard = ({ update, navigate }: GeneralUpdateCardProps) => {
  return (
    <div
      className="p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
      onClick={() => navigate(`/content/general-updates/${update.id}`)}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-y-1">
          <h2 className="font-bold text-sm">{update.name}</h2>
          <div className="flex items-center gap-x-3 text-xs text-zinc-500">
            <span>Start: {formatDate(update.startDate)}</span>
            <span>End: {formatDate(update.endDate)}</span>
            {update.suites && update.suites.length > 0 && (
              <span className="text-blue-600">
                Suite: {update.suites.map((s) => s.name).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralUpdateCard;
