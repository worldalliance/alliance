import type { ComponentType } from "react";
import PlantBasedStudyResults from "../components/projects/plant-based-study/PlantBasedStudyResults";

export type ProgressProject = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  Content: ComponentType;
};

export const PROGRESS_PROJECTS: readonly ProgressProject[] = [
  {
    slug: "plant-based-study",
    title: "Large-scale behavioral study on adopting a plant-based diet",
    date: "2026-07-16",
    summary:
      "We ran a study with 274 people to measure how much less animal product people could eat if they tried.",
    Content: PlantBasedStudyResults,
  },
];

export function getProgressProject(slug: string): ProgressProject | undefined {
  return PROGRESS_PROJECTS.find((project) => project.slug === slug);
}
