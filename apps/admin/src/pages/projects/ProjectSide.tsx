import type { AdminProjectDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { ActionCategoryPicker } from "../../components/ActionCategoryIcons";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { suiteHref } from "../../lib/hrefs";
import type { ProjectCard } from "../../lib/projectCards";
import { useUpdateProjectAdmin } from "../../lib/useProjectsAdmin";
import { cn } from "../../ui/cn";
import { nameLinkClass } from "../../ui/styles";
import { Fact, FactList, SidePanelSection } from "../../ui/templates/Record";
import { ProjectFlags } from "./ProjectCard";
import { countsText, day, totalCompletions } from "./projectRules";
import type { SuiteGroup } from "./projectSuites";
import { totalsText } from "./stepPieces";

/** The project's standing facts, beside every tab. */
export function ProjectSide({
  project,
  card,
  groups,
  onError,
}: {
  project: AdminProjectDto;
  card: ProjectCard;
  groups: SuiteGroup[];
  onError: (message: string | null) => void;
}) {
  const update = useUpdateProjectAdmin({
    onError: (error) =>
      onError(adminRefusalMessage(error, "Couldn't save the categories.")),
  });
  const counts = countsText(card);

  return (
    <>
      <SidePanelSection title="Details">
        <FactList>
          <Fact label="Start">
            {card.startedAt ? day(card.startedAt) : "Not started"}
          </Fact>
          <Fact label="Tasks">{formatCount(card.steps.length)}</Fact>
          <Fact label="Slug">
            <span className="font-mono text-xs break-all">{project.slug}</span>
          </Fact>
          <Fact label="Categories">
            <ActionCategoryPicker
              value={project.category}
              onChange={(category) => {
                onError(null);
                update.mutate({ id: project.id, body: { category } });
              }}
              disabled={update.isPending}
            />
          </Fact>
        </FactList>
      </SidePanelSection>
      {card.steps.length > 0 && (
        <SidePanelSection title="Progress">
          {counts && <p>{counts}</p>}
          <p className="text-caption text-fg-muted tabular-nums">
            {totalsText({
              completions: totalCompletions(card),
              wontComplete: card.wontComplete,
              dismissed: card.dismissed,
            })}
          </p>
        </SidePanelSection>
      )}
      {card.flags.length > 0 && (
        <SidePanelSection title="Needs attention">
          <ProjectFlags flags={card.flags} />
        </SidePanelSection>
      )}
      {groups.length > 0 && (
        <SidePanelSection title="Suites">
          <ul className="flex flex-col">
            {groups.map((group) => (
              <li
                key={group.suite?.id ?? "none"}
                className="flex min-h-8 items-center justify-between gap-2"
              >
                {group.suite ? (
                  <Link
                    to={suiteHref(group.suite.id)}
                    title={group.suite.name}
                    className={cn(nameLinkClass, "truncate")}
                  >
                    {group.suite.name}
                  </Link>
                ) : (
                  <span>No suite</span>
                )}
                <span className="text-fg-muted tabular-nums">
                  {formatCount(group.steps.length)}
                </span>
              </li>
            ))}
          </ul>
        </SidePanelSection>
      )}
    </>
  );
}
