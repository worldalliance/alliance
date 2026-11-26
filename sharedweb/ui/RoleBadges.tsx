import { roleBadges } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

function RoleBadge({
  role,
  className,
}: {
  role: "staff" | "ambassador" | "grouplead";
  className: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "text-xs text-white px-2 py-0.5 rounded-sm self-center cursor-default",
              className,
            )}
          >
            {roleBadges[role].label}
          </div>
        }
      />
      <TooltipContent sideOffset={4}>{roleBadges[role].tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default function RoleBadges({
  staff,
  ambassador,
  grouplead,
}: {
  staff: boolean;
  ambassador: boolean;
  grouplead: boolean;
}) {
  if (!staff && !ambassador && !grouplead) return null;
  return (
    <div className="flex items-center gap-[3px]">
      {staff && <RoleBadge role="staff" className="bg-staff" />}
      {!staff && ambassador && (
        <RoleBadge role="ambassador" className="bg-ambassador" />
      )}
      {!staff && grouplead && (
        <RoleBadge role="grouplead" className="bg-grouplead" />
      )}
    </div>
  );
}
