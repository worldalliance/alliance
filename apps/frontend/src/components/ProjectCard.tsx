import React from "react";
import { href } from "react-router";
import type { ProgressProject } from "../content/projects";
import ProgressCard from "./ProgressCard";

const ProjectCard: React.FC<{ project: ProgressProject }> = ({ project }) => {
  return (
    <ProgressCard
      to={href("/progress/projects/:slug", { slug: project.slug })}
      title={project.title}
      description={project.summary}
      // meta={formatLongDateEnUS(new Date(project.date))}
    />
  );
};

export default ProjectCard;
