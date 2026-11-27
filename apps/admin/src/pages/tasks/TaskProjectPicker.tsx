import type { ProjectDto } from "@alliance/shared/client";
import { optionSections } from "@alliance/shared/forms/optionSections";
import SearchableSelect from "@alliance/sharedweb/forms/SearchableSelect";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  useAssignActionProjectAdmin,
  useProjectsAdmin,
} from "../../lib/useProjectsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { cn } from "../../ui/cn";
import { controlClass } from "../../ui/styles";
import { ProjectNameDialog, type ProjectNameTarget } from "./ProjectNameDialog";

const NO_PROJECT = "none";

const projectOption = (project: ProjectDto) => ({
  value: String(project.id),
  label: project.name,
});

/** Moves the task between projects at once; a project doesn't change who sees the task. */
export function TaskProjectPicker({
  actionId,
  project,
  labelId,
}: {
  actionId: number;
  project: ProjectDto | null;
  labelId: string;
}) {
  const projects = useProjectsAdmin();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [naming, setNaming] = useState<ProjectNameTarget | null>(null);
  const assign = useAssignActionProjectAdmin({
    onError: (error) =>
      setRefusal(
        adminRefusalMessage(error, "Couldn't change the task's project."),
      ),
  });

  return (
    <div className="flex w-full flex-col gap-1.5">
      <SearchableSelect
        labelId={labelId}
        className={cn(controlClass, "h-control w-full")}
        sections={optionSections({
          options: [
            { value: NO_PROJECT, label: "No project" },
            // The task's own project stays listed while the list loads or fails.
            ...(project &&
            !projects.data?.some((candidate) => candidate.id === project.id)
              ? [project]
              : []
            ).map(projectOption),
            ...(projects.data ?? []).map(projectOption),
          ],
        })}
        value={project ? String(project.id) : NO_PROJECT}
        disabled={projects.isPending || assign.isPending}
        onChange={(value) => {
          setRefusal(null);
          assign.mutate({
            actionId,
            projectId: value === NO_PROJECT ? null : Number(value),
          });
        }}
      />
      {projects.isLoadingError && (
        <InlineError
          message={adminRefusalMessage(
            projects.error,
            "Couldn't load the projects.",
          )}
        />
      )}
      {refusal && <InlineError message={refusal} />}
      <div className="flex gap-1">
        {project && (
          <Button
            size="small"
            variant={ButtonVariant.Ghost}
            onClick={() => setNaming({ kind: "rename", project })}
          >
            Rename project…
          </Button>
        )}
        <Button
          size="small"
          variant={ButtonVariant.Ghost}
          onClick={() => setNaming({ kind: "create", actionId })}
        >
          New project…
        </Button>
      </div>
      {naming && (
        <ProjectNameDialog target={naming} onClose={() => setNaming(null)} />
      )}
    </div>
  );
}
