import type { ComponentType } from "react";
import PlantBasedStudyResults from "../components/projects/plant-based-study/PlantBasedStudyResults";
import {
  ActionPriority,
  type ActionPriorityTags,
} from "./featuredImpactActions";

export type ProgressProject = {
  slug: string;
  title: string;
  headline: string;
  date: string;
  summary: string;
  tags: ActionPriorityTags;
  Content: ComponentType;
};

export const PROGRESS_PROJECTS: readonly ProgressProject[] = [
  {
    slug: "plant-based-study",
    title: "Large-scale behavioral study on adopting a plant-based diet",
    headline: "Thinking about eating more plant-based? Here's what to expect.",
    date: "2026-07-16",
    summary:
      "We ran a study with 274 people to measure how much less animal product people could eat if they tried.",
    tags: [ActionPriority.Environment],
    Content: PlantBasedStudyResults,
  },
];

export function getProgressProject(slug: string): ProgressProject | undefined {
  return PROGRESS_PROJECTS.find((project) => project.slug === slug);
}
