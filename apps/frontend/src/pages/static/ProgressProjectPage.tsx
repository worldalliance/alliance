import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { data, useLoaderData } from "react-router";
import { getProgressProject } from "../../content/projects";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";
import { NotFoundSource } from "../../site/NotFoundPage";
import { PageShell } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

export async function loader({ params }: { params: { slug: string } }) {
  const project = getProgressProject(params.slug);
  if (!project) throw data(NotFoundSource.MissingRecord, { status: 404 });
  return {
    slug: project.slug,
    title: project.headline,
  };
}

export function meta({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  return socialPreviewMeta({
    title: data.title,
  });
}

const ProgressProjectPage: React.FC = () => {
  const data = useLoaderData<typeof loader>();
  const project = getProgressProject(data.slug);
  if (!project) throw new Error(`Unknown progress project: ${data.slug}`);

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
