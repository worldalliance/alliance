import { errorMessage } from "@alliance/common/errorMessage";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { CohortSegment } from "../lib/describeCohortExpression";
import { ProjectCardKind, type ProjectCard } from "../lib/projectCards";
import { useCreateProjectAdmin } from "../lib/useProjectsAdmin";
import { ActionCategoryIcons } from "./ActionCategoryIcons";
import ProjectCardBody, {
  ProjectCounts,
  projectSummary,
} from "./ProjectCardBody";
import { ProjectNameInput } from "./ProjectNameInput";
import ProjectWarnings from "./ProjectWarnings";

const MakeProject = ({
  actionId,
  actionName,
}: {
  actionId: number;
  actionName: string;
}) => {
  const toast = useToast();
  const navigate = useNavigate();
  const [naming, setNaming] = useState(false);
  const create = useCreateProjectAdmin({
    onSuccess: (created) => navigate(`/projects/${created.id}`),
    onError: (error) =>
      toast.error(
        errorMessage({ error, fallback: "Could not create the project" }),
      ),
  });
  if (naming) {
    return (
      <div className="relative z-10 pt-1">
        <ProjectNameInput
          initialName={actionName}
          placeholder="Project name"
          saving={create.isPending}
          onSave={(name) => create.mutate({ name, actionId })}
          onCancel={() => setNaming(false)}
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="relative z-10 flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      onClick={() => setNaming(true)}
    >
      <FolderPlus size={14} aria-hidden />
      Make project
    </button>
  );
};

const ProjectCardTile = ({
  card,
  participantsById,
}: {
  card: ProjectCard;
  participantsById: ReadonlyMap<number, CohortSegment[]>;
}) => {
  const href =
    card.kind === ProjectCardKind.Project
      ? `/projects/${card.project.id}`
      : `/actions/${card.action.id}`;
  return (
    <article className="relative flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 hover:border-zinc-400">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-x-2">
          <div className="flex min-w-0 items-center gap-x-2">
            <Link
              to={href}
              className="truncate font-semibold text-zinc-900 after:absolute after:inset-0 after:content-['']"
            >
              {card.name}
            </Link>
            {card.kind === ProjectCardKind.Project && (
              <ActionCategoryIcons categories={card.project.category} />
            )}
          </div>
          {card.kind === ProjectCardKind.Standalone && (
            <MakeProject actionId={card.action.id} actionName={card.name} />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {card.kind === ProjectCardKind.Standalone && (
            <span className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">
              Standalone action
            </span>
          )}
          <ProjectCounts card={card} />
        </div>
        <p className="text-xs text-zinc-600">{projectSummary(card)}</p>
      </header>
      <ProjectWarnings flags={card.flags} />
      <ProjectCardBody
        card={card}
        participantsById={participantsById}
        detailed={false}
      />
    </article>
  );
};

export default ProjectCardTile;
