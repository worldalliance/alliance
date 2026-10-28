import type {
  ActionSuite,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import { ActionStatusBucket, actionStatusBucket } from "./actionStatusBucket";

export type InProgressSuite = {
  id: number;
  name: string;
  actions: { id: number; name: string; bucket: ActionStatusBucket }[];
};

const IN_PROGRESS: Record<ActionStatusBucket, boolean> = {
  [ActionStatusBucket.Draft]: true,
  [ActionStatusBucket.Active]: true,
  [ActionStatusBucket.Pending]: false,
  [ActionStatusBucket.Onboarding]: false,
  [ActionStatusBucket.Completed]: false,
};

/** Suites with a draft or active action, in the order their first such action appears. */
export function inProgressSuites(
  actions: (Pick<
    AdminActionListItemDto,
    "id" | "name" | "status" | "onboarding" | "archived"
  > & {
    suite?: Pick<ActionSuite, "id" | "name">;
  })[],
): InProgressSuite[] {
  const suites = new Map<number, InProgressSuite>();
  for (const action of actions) {
    const bucket = actionStatusBucket(action);
    if (!action.suite || action.archived || !IN_PROGRESS[bucket]) continue;
    const suite = suites.get(action.suite.id) ?? {
      id: action.suite.id,
      name: action.suite.name,
      actions: [],
    };
    suite.actions.push({ id: action.id, name: action.name, bucket });
    suites.set(suite.id, suite);
  }
  return [...suites.values()];
}
