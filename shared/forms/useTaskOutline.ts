import { isEqual } from "es-toolkit";
import { useState } from "react";
import { flowScreenHeading, type FlowScreen } from "./flowScreens";
import { type TaskFlowFormState } from "./useTaskFlow";
import { SourceHistoriesStatus } from "./useVariableSourceHistories";

export type OutlineStep = {
  heading: string;
  /** The member has moved past every visible page under this heading. */
  done: boolean;
};

function outlineInputFailed(form: TaskFlowFormState): boolean {
  if (form.draftFailed) return true;
  // Variables report an error while their inputs load, so the gate goes first.
  switch (form.gate.status) {
    case SourceHistoriesStatus.Loading:
      return false;
    case SourceHistoriesStatus.Failed:
    case SourceHistoriesStatus.SourceDeleted:
      return true;
    case SourceHistoriesStatus.Ready:
      return form.variablesError !== null || form.visibilityFailed;
    default:
      throw new Error(
        `unknown variable inputs status: ${form.gate satisfies never}`,
      );
  }
}

/**
 * The distinct non-blank headers of the visible pages, null until visibility,
 * variables, the draft and the saved screen settle. Empty when the outline is off, no page has a
 * header, or visibility, variables or a draft fetch fail before it lists; once
 * listed, it keeps its last listing while they fail or reload.
 */
export function useTaskOutline(params: {
  enabled: boolean;
  form: TaskFlowFormState;
  screens: FlowScreen[];
  visibleIndices: number[];
  /**
   * The screen the member resumes at; every screen before it is done. Null
   * when no screen is visible, undefined until the saved screen loads.
   */
  resumeAt: number | null | undefined;
}): OutlineStep[] | null {
  const { enabled, form, screens, visibleIndices, resumeAt } = params;
  // A failure before the outline lists shows the begin row without one. One
  // arriving after the input recovers would push begin down, so it stays empty
  // for this mount. Once listed, the outline keeps its last listing while an
  // input fails or reloads, since emptying it would move begin up.
  const inputFailed = outlineInputFailed(form);
  const [outlineFailed, setOutlineFailed] = useState(false);
  const [listedOutline, setListedOutline] = useState<string[] | null>(null);
  if (inputFailed && listedOutline === null && !outlineFailed) {
    setOutlineFailed(true);
  }
  const inputsReady =
    !inputFailed &&
    !outlineFailed &&
    form.gate.status === SourceHistoriesStatus.Ready &&
    form.visibilitySettled &&
    form.draftSettled;
  const headingAt = (index: number) =>
    flowScreenHeading({ screen: screens[index], form })?.trim() || null;
  const liveOutline = inputsReady
    ? [
        ...new Set(
          visibleIndices.flatMap((index) => {
            const heading = headingAt(index);
            return heading ? [heading] : [];
          }),
        ),
      ]
    : null;
  if (liveOutline && !isEqual(liveOutline, listedOutline)) {
    setListedOutline(liveOutline);
  }

  // An outline that can't list anything is empty rather than pending, so the
  // begin row doesn't wait on it.
  if (!enabled || !screens.some((screen) => screen.heading)) return [];
  if (outlineFailed || (inputFailed && listedOutline === null)) return [];
  const headings = liveOutline ?? listedOutline;
  // Listing the steps before their done state is known would turn them green
  // after they appear.
  if (headings === null || resumeAt === undefined) return null;
  return headings.map((heading) => {
    const under = visibleIndices.filter(
      (index) => headingAt(index) === heading,
    );
    return {
      heading,
      done:
        resumeAt !== null &&
        under.length > 0 &&
        under.every((index) => index < resumeAt),
    };
  });
}
