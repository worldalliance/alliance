import { errorMessage } from "@alliance/common/errorMessage";
import type { AdminProjectDto } from "@alliance/shared/client";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import type React from "react";
import { useState } from "react";
import { useUpdateProjectAdmin } from "../lib/useProjectsAdmin";
import { ActionCategoryPicker } from "./ActionCategoryIcons";
import { ProjectNameInput } from "./ProjectNameInput";
import { secondaryButtonClass } from "./ui/controlStyles";
import Section from "./ui/Section";

enum EditField {
  None = "none",
  Name = "name",
  Slug = "slug",
}

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[8rem_1fr] items-center gap-x-4 py-2">
    <dt className="text-sm text-zinc-600">{label}</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

const ProjectDetails = ({ project }: { project: AdminProjectDto }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(EditField.None);
  const update = useUpdateProjectAdmin({
    onSuccess: () => setEditing(EditField.None),
    onError: (error) =>
      toast.error(
        errorMessage({ error, fallback: "Could not update the project" }),
      ),
  });

  const editable = (params: {
    field: EditField.Name | EditField.Slug;
    value: string;
    label: string;
    display: React.ReactNode;
  }) =>
    editing === params.field ? (
      <ProjectNameInput
        initialName={params.value}
        placeholder={params.label}
        saving={update.isPending}
        onSave={(value) =>
          update.mutate({
            id: project.id,
            body:
              params.field === EditField.Name
                ? { name: value }
                : { slug: value },
          })
        }
        onCancel={() => setEditing(EditField.None)}
      />
    ) : (
      <div className="flex items-center gap-3">
        {params.display}
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => setEditing(params.field)}
        >
          Edit {params.label.toLowerCase()}
        </button>
      </div>
    );

  return (
    <Section title="Details">
      <dl className="-my-2 divide-y divide-zinc-100">
        <Row label="Name">
          {editable({
            field: EditField.Name,
            value: project.name,
            label: "Project name",
            display: <span className="text-sm">{project.name}</span>,
          })}
        </Row>
        <Row label="Slug">
          {editable({
            field: EditField.Slug,
            value: project.slug,
            label: "Project slug",
            display: (
              <span className="font-mono text-sm text-zinc-700">
                {project.slug}
              </span>
            ),
          })}
        </Row>
        <Row label="Categories">
          <ActionCategoryPicker
            value={project.category}
            onChange={(category) =>
              update.mutate({ id: project.id, body: { category } })
            }
            disabled={update.isPending}
            showLabels
          />
        </Row>
      </dl>
    </Section>
  );
};

export default ProjectDetails;
