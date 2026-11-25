import { ExceptionEvent } from "@alliance/common/analytics";
import { UnrenderableReason } from "@alliance/common/forms/unrenderable";
import { useEffect } from "react";
import { captureException } from "../lib/analytics";

export enum UnrenderableSubject {
  Form = "form",
  Update = "update",
}

const REASON_EVENT: Record<UnrenderableReason, ExceptionEvent> = {
  [UnrenderableReason.OutdatedClient]: ExceptionEvent.ContentNeedsNewerClient,
  [UnrenderableReason.ContentProblem]: ExceptionEvent.ContentUnrenderable,
};

export function unrenderableTitle(
  subject: UnrenderableSubject,
  reason: UnrenderableReason,
): string {
  switch (reason) {
    case UnrenderableReason.OutdatedClient:
      return `This ${subject} needs the latest version of Alliance`;
    case UnrenderableReason.ContentProblem:
      return `There's a problem with this ${subject}`;
    default:
      throw new Error(`unknown reason: ${reason satisfies never}`);
  }
}

/** Which content a report is about, so staff can find it. */
export type UnrenderableContent =
  | { formId: number; formSnapshotId: number | null; actionId: number }
  | { actionUpdateId: number }
  | { generalUpdateId: number };

export const CONTENT_PROBLEM_ADVICE = "Please try again later.";

const reported = new Set<string>();

export function __resetReportedUnrenderableForTests(): void {
  reported.clear();
}

/**
 * Reports a notice once per session for each piece of content and problem,
 * however many cards show it or remount.
 */
function useReportUnrenderable(params: {
  subject: UnrenderableSubject;
  reason: UnrenderableReason;
  /** The unknown kind or the error, never the member's answers. */
  detail: string | null;
  content: UnrenderableContent;
}) {
  const { subject, reason, detail, content } = params;
  useEffect(() => {
    const key = JSON.stringify([subject, reason, detail, content]);
    if (reported.has(key)) return;
    reported.add(key);
    captureException(
      REASON_EVENT[reason],
      new Error(`${subject} can't be shown: ${reason}`),
      { subject, reason, detail, ...content },
    );
  }, [subject, reason, detail, content]);
}

export function ReportUnrenderable(
  params: Parameters<typeof useReportUnrenderable>[0],
): null {
  useReportUnrenderable(params);
  return null;
}
