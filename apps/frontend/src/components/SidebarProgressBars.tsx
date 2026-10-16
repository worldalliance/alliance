import AggregateProgressBarBlock from "@alliance/sharedweb/ui/AggregateProgressBarBlock";
import { href, Link } from "react-router";
import { type SidebarProgressBarEntry } from "../lib/fetchTaskFormProgressViews";

export default function SidebarProgressBars({
  entries,
}: {
  entries: SidebarProgressBarEntry[];
}) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-y-3">
      <div className="flex flex-col gap-y-2">
        {entries.map(({ action, progressBars }) => (
          <Link
            key={action.id}
            to={href("/actions/:id", { id: action.id.toString() })}
            className="block p-4 rounded bg-white hover:bg-grey-1"
          >
            <p className="text-sm font-medium text-green mb-2">{action.name}</p>
            <div className="flex flex-col gap-y-2">
              {progressBars.map((view) => (
                <AggregateProgressBarBlock
                  key={view.id}
                  view={view}
                  titleClassName="text-base font-medium text-black"
                  captionClassName="text-sm text-zinc-600"
                  className="flex flex-col gap-y-1"
                />
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
