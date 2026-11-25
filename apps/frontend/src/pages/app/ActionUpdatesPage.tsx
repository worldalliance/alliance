import {
  useActionUpdateNewState,
  useAllActionUpdates,
} from "@alliance/shared/lib/useActionUpdates";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import HomeUpdateCard from "../../components/HomeUpdateCard";

const ActionUpdatesPage = () => {
  const { data: updates = [], isPending, isError } = useAllActionUpdates();
  const { isNew, markOpened } = useActionUpdateNewState(updates);

  return (
    <CenterLayout>
      <div className="gap-y-4 flex flex-col">
        <h1 className="text-lg font-medium text-black">Project updates</h1>

        {isPending && <p className="text-zinc-500">Loading updates…</p>}
        {isError && (
          <p className="text-zinc-500">Failed to load action updates</p>
        )}
        {!isPending && !isError && updates.length === 0 && (
          <p className="text-zinc-500">No updates yet.</p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2">
          {updates.map((update) => (
            <li key={update.id}>
              <HomeUpdateCard
                update={update}
                isNew={isNew(update.id)}
                onOpen={markOpened}
              />
            </li>
          ))}
        </ul>
      </div>
    </CenterLayout>
  );
};

export default ActionUpdatesPage;
