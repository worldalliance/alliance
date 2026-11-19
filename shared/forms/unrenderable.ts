import { UnrenderableReason } from "@alliance/common/forms/unrenderable";

export enum UnrenderableSubject {
  Form = "form",
  Update = "update",
}

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

export const CONTENT_PROBLEM_ADVICE = "Please try again later.";
