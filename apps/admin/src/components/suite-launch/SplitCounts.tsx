import { pickForCount, withCount } from "@alliance/common/plural";
import type { UserDto } from "@alliance/shared/client";
import { TriangleAlert } from "lucide-react";
import type { SplitPreview } from "./splitPreview";
import type { LaunchAction } from "./useSuiteLaunchData";

export default function SplitCounts({
  splits,
  actions,
  users,
}: {
  splits: SplitPreview[];
  actions: LaunchAction[];
  users: UserDto[];
}) {
  const nameOf = (actionId: number) =>
    actions.find(({ action }) => action.id === actionId)?.action.name ??
    `Action #${actionId}`;
  const userName = (userId: number) =>
    users.find((user) => user.id === userId)?.name ?? `User #${userId}`;
  return (
    <div className="flex flex-col gap-3">
      {splits.map((split) => {
        const unrouted = split.unroutedUserIds.length;
        return (
          <section
            key={split.splitId}
            aria-label={`Split ${split.title}`}
            className="text-sm"
          >
            <h4 className="font-medium">
              Split: {split.title}{" "}
              <span className="font-normal text-zinc-500">
                reaches {withCount(split.reachedCount, "member")}
              </span>
            </h4>
            <ul className="ml-4">
              {split.arms.map((arm) => (
                <li key={arm.actionId}>
                  {nameOf(arm.actionId)}: {withCount(arm.memberCount, "member")}
                </li>
              ))}
            </ul>
            {unrouted > 0 && (
              <p className="flex items-start gap-1 text-red-600">
                <TriangleAlert
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden
                />
                {withCount(unrouted, "member")} the split reaches{" "}
                {pickForCount(unrouted, "gets", "get")} no arm:{" "}
                {split.unroutedUserIds.map(userName).join(", ")}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
