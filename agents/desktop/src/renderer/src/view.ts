export enum ViewKind {
  Repository = "repository",
  NewTask = "new-task",
  Ask = "ask",
  Task = "task",
  Conversation = "conversation",
}

/** What the main pane shows. */
export type View =
  | { kind: ViewKind.Repository }
  | { kind: ViewKind.NewTask }
  | { kind: ViewKind.Ask }
  | { kind: ViewKind.Task; key: string }
  | { kind: ViewKind.Conversation; id: string };

export const sameView = (a: View, b: View): boolean =>
  a.kind === b.kind &&
  (a.kind !== ViewKind.Task || (b.kind === ViewKind.Task && a.key === b.key)) &&
  (a.kind !== ViewKind.Conversation ||
    (b.kind === ViewKind.Conversation && a.id === b.id));
