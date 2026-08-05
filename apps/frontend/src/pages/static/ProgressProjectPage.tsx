import React from "react";
import { useLoaderData } from "react-router";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import { getProgressProject } from "../../content/projects";
import { socialPreviewMeta } from "../../lib/socialPreviewMeta";

export async function loader({ params }: { params: { slug: string } }) {
  const project = getProgressProject(params.slug);
  if (!project) {
    return { slug: null as string | null, title: null as string | null };
  }
  return {
    slug: project.slug,
    title: project.title,
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
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <PrelaunchNavbar transparent={false} absolute={false} />
        <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
          <div className="mx-auto w-full max-w-3xl">
            <h1 className="text-title">Project not found</h1>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const { Content } = project;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-28 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-[960px]">
          <Content />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressProjectPage;
