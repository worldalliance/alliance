import { errorMessage } from "@alliance/common/errorMessage";
import type { ProjectDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { ActionProjectControls } from "../../components/ActionProjectControls";
import { useProjectAdmin } from "../../lib/useProjectsAdmin";

const StepPosition = ({
  actionId,
  project,
}: {
  actionId: number;
  project: ProjectDto;
}) => {
  const { data, error } = useProjectAdmin(project.id);
  const index = data?.steps.findIndex((step) => step.actionId === actionId);
  return (
    <p className="text-sm text-zinc-700">
      In project{" "}
      <Link to={`/projects/${project.id}`} className="text-blue-600 underline">
        {project.name}
      </Link>
      {data && index !== undefined && index >= 0 && (
        <>
          : step {index + 1} of {data.steps.length}
        </>
      )}
      {error && (
        <span role="alert" className="text-red-600">
          . {errorMessage({ error, fallback: "Could not load its steps" })}
        </span>
      )}
    </p>
  );
};

const ActionProjectRow = ({
  actionId,
  project,
}: {
  actionId: number;
  project: ProjectDto | null;
}) => (
  <section
    aria-label="Project"
    className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3"
  >
    {project && <StepPosition actionId={actionId} project={project} />}
    <ActionProjectControls actionId={actionId} project={project} />
  </section>
);

export default ActionProjectRow;
