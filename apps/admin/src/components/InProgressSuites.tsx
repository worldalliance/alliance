import type { AdminActionListItemDto } from "@alliance/shared/client";
import { Link } from "react-router";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ACTION_STATUS_BUCKET_TONES,
  ActionStatusBucket,
} from "../lib/actionStatusBucket";
import { inProgressSuites } from "../lib/inProgressSuites";
import Section from "./ui/Section";
import StatusPill from "./ui/StatusPill";

const InProgressSuites = ({
  actions,
}: {
  actions: AdminActionListItemDto[];
}) => {
  const suites = inProgressSuites(actions);
  if (suites.length === 0) return null;
  return (
    <Section
      title="In-progress suites"
      meta={suites.length}
      collapsible={{ defaultOpen: true }}
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-x-8 gap-y-4">
        {suites.map((suite) => (
          <li key={suite.id} className="flex flex-col gap-2 text-sm">
            <div>
              <Link
                to={`/suites/${suite.id}`}
                className="font-semibold text-zinc-900 underline-offset-2 hover:underline"
              >
                {suite.name}
              </Link>
              <span className="ml-2 text-zinc-500">
                {Object.values(ActionStatusBucket)
                  .map((bucket) => {
                    const count = suite.actions.filter(
                      (action) => action.bucket === bucket,
                    ).length;
                    return (
                      count > 0 &&
                      `${count} ${ACTION_STATUS_BUCKET_LABELS[bucket].toLowerCase()}`
                    );
                  })
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {suite.actions.map((action) => (
                <li key={action.id} className="flex items-center gap-2">
                  <StatusPill
                    tone={ACTION_STATUS_BUCKET_TONES[action.bucket]}
                    label={ACTION_STATUS_BUCKET_LABELS[action.bucket]}
                  />
                  <Link
                    to={`/actions/${action.id}`}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    {action.name}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
};

export default InProgressSuites;
