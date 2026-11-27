import { NodeEnv } from "@alliance/common/node-env";
import { cn } from "@alliance/shared/styles/util";
import { webEnvironment } from "@alliance/sharedweb/lib/runtimeConfig";

const LOCAL = {
  label: "Local",
  short: "Local",
  className: "bg-zinc-200 text-zinc-700",
};

const ENVIRONMENT_BADGE: Record<
  NodeEnv,
  { label: string; short: string; className: string }
> = {
  [NodeEnv.Production]: {
    label: "Production",
    short: "Prod",
    className: "bg-red-600 text-white",
  },
  [NodeEnv.Staging]: {
    label: "Staging",
    short: "Stg",
    className: "bg-amber-100 text-amber-900",
  },
  [NodeEnv.Development]: LOCAL,
  [NodeEnv.Test]: LOCAL,
};

const EnvironmentBadge = ({ collapsed }: { collapsed: boolean }) => {
  const environment = ENVIRONMENT_BADGE[webEnvironment()];
  return (
    <span
      title={environment.label}
      className={cn(
        "w-fit rounded-md px-1.5 py-0.5 text-xs font-semibold",
        environment.className,
      )}
    >
      {collapsed ? environment.short : environment.label}
    </span>
  );
};

export default EnvironmentBadge;
