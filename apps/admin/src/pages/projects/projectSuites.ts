import type { AdminActionListItemDto } from "@alliance/shared/client";
import type { ProjectStep } from "../../lib/projectCards";

type Suite = { id: number; name: string };

export type SuiteGroup = {
  /** Null for the tasks in no suite. */
  suite: Suite | null;
  steps: ProjectStep[];
};

/**
 * The project's tasks by suite, each suite where its first task falls in the
 * project's order, and the tasks in no suite last. `actions` carries each
 * task's suite, which the project's steps leave out.
 */
export const tasksBySuite = (params: {
  steps: ProjectStep[];
  actions: AdminActionListItemDto[];
}): SuiteGroup[] => {
  const suiteByTask = new Map(
    params.actions.map((action) => [action.id, action.suite]),
  );
  const groups = new Map<number, SuiteGroup>();
  const loose: ProjectStep[] = [];
  for (const step of params.steps) {
    const suite = suiteByTask.get(step.id);
    if (!suite) {
      loose.push(step);
      continue;
    }
    const group = groups.get(suite.id) ?? {
      suite: { id: suite.id, name: suite.name },
      steps: [],
    };
    group.steps.push(step);
    groups.set(suite.id, group);
  }
  return [
    ...groups.values(),
    ...(loose.length > 0 ? [{ suite: null, steps: loose }] : []),
  ];
};
