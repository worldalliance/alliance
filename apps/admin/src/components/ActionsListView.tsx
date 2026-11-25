import type { AdminActionListItemDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { groupBySuite } from "../lib/groupActionsBySuite";
import ActionListCard from "./ActionListCard";
import Section from "./ui/Section";

const ActionRows = ({ actions }: { actions: AdminActionListItemDto[] }) => (
  <ul className="-m-4 divide-y divide-zinc-200">
    {actions.map((action) => (
      <li key={action.id}>
        <ActionListCard action={action} />
      </li>
    ))}
  </ul>
);

const ActionsListView = ({
  actions,
  groupedBySuite,
}: {
  actions: AdminActionListItemDto[];
  groupedBySuite: boolean;
}) =>
  groupedBySuite ? (
    <div className="flex flex-col gap-4">
      {groupBySuite(actions).map((suite) => (
        <Section
          key={suite.id ?? "no-suite"}
          title={suite.name}
          meta={suite.actions.length}
          actions={
            suite.id !== null && (
              <Link
                to={`/suites/${suite.id}`}
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                Open suite
                <span className="sr-only"> {suite.name}</span>
              </Link>
            )
          }
        >
          <ActionRows actions={suite.actions} />
        </Section>
      ))}
    </div>
  ) : (
    <Section title="Actions" meta={actions.length}>
      <ActionRows actions={actions} />
    </Section>
  );

export default ActionsListView;
