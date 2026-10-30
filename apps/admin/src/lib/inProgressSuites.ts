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
  actions: { id: number; name: string; bucket: ActionStatusBucket }[];
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
    "id" | "name" | "status" | "onboarding" | "archived"
  > & {
    suite?: Pick<ActionSuite, "id" | "name">;
  })[],
): InProgressSuite[] {
  const suites = new Map<number, InProgressSuite>();
  for (const action of actions) {
    const bucket = actionStatusBucket(action);
    const counted = COUNTED_BUCKET[bucket];
    if (!action.suite || action.archived || !counted) continue;
    const suite = suites.get(action.suite.id) ?? {
      id: action.suite.id,
      name: action.suite.name,
      draftCount: 0,
      activeCount: 0,
      actions: [],
    };
    suite[counted] += 1;
    suite.actions.push({ id: action.id, name: action.name, bucket });
    suites.set(suite.id, suite);
  }
  return [...suites.values()];
}
