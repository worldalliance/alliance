import { ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { countOf, formatCount } from "../../lib/formatNumber";
import {
  buildProjectCards,
  cardsByLifecycle,
  PROJECT_LIFECYCLE_ORDER,
  ProjectCardKind,
  type ProjectCard as Card,
  type ProjectLifecycle,
} from "../../lib/projectCards";
import {
  ProjectsLoad,
  useProjectsPageData,
} from "../../lib/useProjectsPageData";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Skeleton } from "../../ui/Skeleton";
import {
  FilterBar,
  ListContent,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectCard } from "./ProjectCard";
import {
  cardMatches,
  COLLAPSIBLE,
  projectsFirst,
  SECTION_TITLES,
} from "./projectRules";

const GRID = "grid grid-cols-1 gap-section @4xl:grid-cols-2 @7xl:grid-cols-3";

const boardSkeleton = (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-6 w-24" />
    <div className={GRID}>
      {Array.from({ length: 4 }, (_, card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card"
        >
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      ))}
    </div>
  </div>
);

/** "14 projects · 60 standalone tasks", of the cards shown. */
const boardCount = (cards: Card[]) => {
  if (cards.length === 0) return undefined;
  const projects = cards.filter(
    (card) => card.kind === ProjectCardKind.Project,
  ).length;
  return [
    countOf(projects, "project"),
    countOf(cards.length - projects, "standalone task"),
  ].join(" · ");
};

type Naming = { fromTask?: { id: number; name: string } };

export default function ProjectsPage() {
  const data = useProjectsPageData();
  const [q, setQ] = useListSearch();
  const [doneOpen, setDoneOpen] = useState(false);
  const [naming, setNaming] = useState<Naming | null>(null);
  const doneId = useId();

  const now = new Date();
  const ready = data.load === ProjectsLoad.Ready;
  const all = ready
    ? buildProjectCards({ projects: data.projects, actions: data.actions, now })
    : [];
  const shown = all.filter((card) => cardMatches(card, q));
  const sections = cardsByLifecycle(shown);
  const filtered = q.trim() !== "";
  // A search opens Done, or its matches would be out of sight.
  const isOpen = (lifecycle: ProjectLifecycle) =>
    !COLLAPSIBLE[lifecycle] || doneOpen || filtered;

  return (
    <Page
      fill
      place={PlaceId.Projects}
      description="Tasks grouped by subject. A task in no project is a standalone task."
      actions={
        <Button variant={ButtonVariant.Primary} onClick={() => setNaming({})}>
          New project…
        </Button>
      }
      banner={
        <RefreshFailedBanner
          parts={[
            { things: "projects", query: data.projectsQuery },
            { things: "tasks", query: data.actionsQuery },
            { things: "project updates", query: data.updatesQuery },
          ]}
        />
      }
    >
      <FilterBar count={boardCount(shown)}>
        <SearchField
          label="Filter projects and tasks"
          value={q}
          onChange={setQ}
          className="w-72"
        />
      </FilterBar>
      <ListContent cards>
        <ContentState
          loading={data.load === ProjectsLoad.Pending}
          skeleton={boardSkeleton}
          error={data.load === ProjectsLoad.Failed ? data.error : null}
          errorTitle="Couldn't load projects"
          onRetry={data.retry}
          retrying={data.retrying}
          empty={shown.length === 0}
          filtered={filtered}
          onClearFilters={() => setQ("")}
          emptyTitle="No projects yet"
          emptyDescription="A project groups the tasks on one subject."
          emptyAction={
            <Button
              variant={ButtonVariant.Default}
              onClick={() => setNaming({})}
            >
              New project…
            </Button>
          }
        >
          {PROJECT_LIFECYCLE_ORDER.filter(
            (lifecycle) => sections[lifecycle].length > 0,
          ).map((lifecycle) => {
            const cards = projectsFirst(sections[lifecycle]);
            const open = isOpen(lifecycle);
            const title = (
              <>
                {SECTION_TITLES[lifecycle]}
                <span className="text-caption font-medium text-fg-muted tabular-nums">
                  {formatCount(cards.length)}
                </span>
              </>
            );
            return (
              <section key={lifecycle} className="flex flex-col gap-3">
                <h2 className="flex min-h-control-sm items-center text-heading font-semibold">
                  {COLLAPSIBLE[lifecycle] ? (
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? doneId : undefined}
                      // Open already while a search holds it open.
                      disabled={filtered}
                      onClick={() => setDoneOpen((was) => !was)}
                      className="-ml-1.5 flex h-control-sm items-center gap-2 rounded-md pr-2 pl-1 focus-ring hover:bg-line disabled:hover:bg-transparent"
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={cn(
                          "size-4 text-fg-muted transition-transform duration-fast",
                          open && "rotate-90",
                        )}
                      />
                      {title}
                    </button>
                  ) : (
                    <span className="flex items-center gap-2">{title}</span>
                  )}
                </h2>
                {open && (
                  <div
                    id={COLLAPSIBLE[lifecycle] ? doneId : undefined}
                    className={GRID}
                  >
                    {cards.map((card) => (
                      <ProjectCard
                        key={card.key}
                        card={card}
                        participantsById={
                          ready ? data.participantsById : new Map()
                        }
                        now={now}
                        onMakeProject={(fromTask) => setNaming({ fromTask })}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </ContentState>
      </ListContent>
      {naming && (
        <NewProjectDialog
          fromTask={naming.fromTask}
          onClose={() => setNaming(null)}
        />
      )}
    </Page>
  );
}
