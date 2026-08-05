import React from "react";
import BalancedColumns from "../../components/BalancedColumns";
import FeaturedImpactCard from "../../components/FeaturedImpactCard";
import Footer from "../../components/Footer";
import PrelaunchNavbar from "../../components/PrelaunchNavbar";
import ProjectCard from "../../components/ProjectCard";
import { FEATURED_IMPACT_ACTIONS } from "../../content/featuredImpactActions";
import { PROGRESS_PROJECTS } from "../../content/projects";

const ProgressListPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PrelaunchNavbar transparent={false} absolute={false} />
      <div className="flex-1 container mx-auto pt-16 md:pt-20 pb-56 flex flex-col px-5">
        <div className="mx-auto w-full max-w-7xl flex flex-col gap-8 md:gap-20">
          <h1 className="text-title-large text-center">Progress</h1>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-title-medium">Projects</h2>
              <p className="text-zinc-500 text-lg md:text-xl">
                Series of actions that built on each other.
              </p>
            </div>
            <BalancedColumns columns={1}>
              {PROGRESS_PROJECTS.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </BalancedColumns>
          </section>

          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-title-medium">Actions</h2>
              <p className="text-zinc-500 text-lg md:text-xl">
                One-time actions that achieved tangible impact.
              </p>
            </div>
            <BalancedColumns columns={{ default: 1, sm: 2, md: 3 }}>
              {FEATURED_IMPACT_ACTIONS.map((action) => (
                <FeaturedImpactCard key={action.actionId} {...action} />
              ))}
            </BalancedColumns>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProgressListPage;
