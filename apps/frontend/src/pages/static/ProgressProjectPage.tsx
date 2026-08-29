import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { useLoaderData } from "react-router";
import { getProgressProject } from "../../content/projects";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export async function loader({ params }: { params: { slug: string } }) {
  const project = getProgressProject(params.slug);
  if (!project) {
    return { slug: null as string | null, title: null as string | null };
  }
  return {
    slug: project.slug,
    title: project.headline,
  };
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  return socialPreviewMeta({
    title: data.title ?? "Project not found",
  });
}

const ProgressProjectPage: React.FC = () => {
  const data = useLoaderData<typeof loader>();
  const project = data.slug ? getProgressProject(data.slug) : undefined;

  if (!project) {
    return <PageShell title="Project not found">{null}</PageShell>;
  }

  const { Content } = project;

  return (
    <PageShell
      title={project.headline}
      subtitle={project.summary}
      titleClassName="max-w-[20ch] text-balance"
    >
      <div className={cn(SITE_COL, "pt-16 pb-20 lg:pt-20 lg:pb-28")}>
        <Content />
      </div>
    </PageShell>
  );
};

export default ProgressProjectPage;
