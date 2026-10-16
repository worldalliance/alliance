import { homePagePriorityComparator } from "@alliance/shared/lib/actionUtils";
import { type ParsedGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import LargeGeneralUpdateCard from "@alliance/sharedweb/ui/LargeGeneralUpdateCard";
import { useMemo } from "react";
import HomeUpdatesRow from "./HomeUpdatesRow";
import LoadFailed, { type LoadFailure } from "./LoadFailed";

export default function HomeGeneralUpdates({
  generalUpdates,
  failure,
  onDismiss,
}: {
  generalUpdates: ParsedGeneralUpdate[] | null;
  failure: LoadFailure | null;
  onDismiss: (generalUpdateId: number) => Promise<void>;
}) {
  const sortedGeneralUpdates = useMemo(
    () => [...(generalUpdates ?? [])].sort(homePagePriorityComparator),
    [generalUpdates],
  );

  return (
    <>
      <HomeUpdatesRow />
      {failure && (
        <LoadFailed message="Couldn't load general updates." {...failure} />
      )}
      {sortedGeneralUpdates.length > 0 && (
        <div className="flex flex-col gap-3">
          {sortedGeneralUpdates.map((generalUpdate) => (
            <LargeGeneralUpdateCard
              key={generalUpdate.id}
              title={generalUpdate.name}
              schema={generalUpdate.schema}
              onDismiss={() => onDismiss(generalUpdate.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
