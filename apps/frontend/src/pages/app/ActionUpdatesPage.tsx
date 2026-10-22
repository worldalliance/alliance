import { useAllActionUpdates } from "@alliance/shared/lib/useActionUpdates";
import ActionUpdateCard from "@alliance/sharedweb/ui/ActionUpdateCard";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";

const ActionUpdatesPage = () => {
  const { data: updates = [], isError } = useAllActionUpdates();

  return (
    <CenterLayout>
      <div className="gap-y-4 flex flex-col">
        <h1 className="text-title mb-3">Action updates</h1>

        <div className="flex flex-col gap-y-4 text-base">
          {[...updates]
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
            )
            .map((update) => (
              <ActionUpdateCard
                key={update.id}
                update={update}
                onActionPageTimeline={false}
              />
            ))}
          {isError && (
            <p className="text-zinc-500">Failed to load action updates</p>
          )}
        </div>
      </div>
    </CenterLayout>
  );
};

export default ActionUpdatesPage;
