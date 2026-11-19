export enum UnrenderableReason {
  /** A newer client would show it. */
  OutdatedClient = "outdatedClient",
  /** No client would show it: the content itself is wrong. */
  ContentProblem = "contentProblem",
}

export type Unrenderable = { reason: UnrenderableReason; detail: string };

export function formUnrenderable(form: {
  unknownKind: string | null;
  variablesError: string | null;
}): Unrenderable | null {
  if (form.unknownKind !== null) {
    return {
      reason: UnrenderableReason.OutdatedClient,
      detail: `Unknown to this build: ${form.unknownKind}`,
    };
  }
  if (form.variablesError !== null) {
    return {
      reason: UnrenderableReason.ContentProblem,
      detail: form.variablesError,
    };
  }
  return null;
}
