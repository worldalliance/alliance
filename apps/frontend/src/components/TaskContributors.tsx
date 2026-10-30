import { type ActionDto } from "@alliance/shared/client";
import { taskFlowContributors } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow } from "@alliance/shared/lib/copy";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";

export default function TaskContributors({ action }: { action: ActionDto }) {
  const contributors = taskFlowContributors(action);
  if (contributors.length === 0) return null;

  return (
    <section className="mt-6">
      <h3 className="mb-3 text-base font-semibold text-zinc-900">
        {taskFlow.contributors}
      </h3>
      <ul className="flex flex-wrap gap-x-6 gap-y-3">
        {contributors.map((contributor) => (
          <li key={contributor.key} className="flex items-center gap-x-2">
            <AvatarProfile
              pfp={contributor.picture}
              size="medium"
              alt={contributor.name}
            />
            <div className="leading-tight">
              <p className="text-base text-zinc-900">{contributor.name}</p>
              <p className="text-sm text-zinc-500">{contributor.role}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
