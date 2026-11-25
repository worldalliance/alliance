import { href } from "react-router";

export const memberHref = (userId: number) =>
  href("/members/:userId", { userId: userId.toString() });

export const groupHref = (groupId: number) =>
  href("/members/groups/:id", { id: groupId.toString() });

export const taskHref = (actionId: number) =>
  href("/tasks/:actionId", { actionId: actionId.toString() });

export const suiteHref = (suiteId: number) =>
  href("/tasks/suites/:suiteId", { suiteId: suiteId.toString() });

export const projectHref = (projectId: number) =>
  href("/tasks/projects/:projectId", { projectId: projectId.toString() });
