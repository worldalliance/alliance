import type {
  ActionSuite,
  AdminActionListItemDto,
} from "@alliance/shared/client";
import { ActionStatusBucket, actionStatusBucket } from "./actionStatusBucket";

export type InProgressSuite = {
  id: number;
  name: string;
  draftCount: number;
  activeCount: number;
};

const COUNTED_BUCKET: Record<
  ActionStatusBucket,
  "draftCount" | "activeCount" | null
> = {
  [ActionStatusBucket.Draft]: "draftCount",
  [ActionStatusBucket.Active]: "activeCount",
  [ActionStatusBucket.Pending]: null,
  [ActionStatusBucket.Onboarding]: null,
  [ActionStatusBucket.Completed]: null,
};

/** Suites with a draft or active action, in the order their first such action appears. */
export function inProgressSuites(
  actions: (Pick<
    AdminActionListItemDto,
    "status" | "onboarding" | "archived"
  > & {
    suite?: Pick<ActionSuite, "id" | "name">;
  })[],
): InProgressSuite[] {
  const suites = new Map<number, InProgressSuite>();
  for (const action of actions) {
    const counted = COUNTED_BUCKET[actionStatusBucket(action)];
    if (!action.suite || action.archived || !counted) continue;
    const suite = suites.get(action.suite.id) ?? {
      id: action.suite.id,
      name: action.suite.name,
      draftCount: 0,
      activeCount: 0,
    };
    suite[counted] += 1;
    suites.set(suite.id, suite);
  }
  return [...suites.values()];
}
