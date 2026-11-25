export enum ViewKind {
  Repository = "repository",
  NewWorktree = "new-worktree",
  Ask = "ask",
  Worktree = "worktree",
  Conversation = "conversation",
}

/** What the main pane shows. */
export type View =
  | { kind: ViewKind.Repository }
  | { kind: ViewKind.NewWorktree }
  | { kind: ViewKind.Ask }
  | { kind: ViewKind.Worktree; key: string }
  | { kind: ViewKind.Conversation; id: string };

export const sameView = (a: View, b: View): boolean =>
  a.kind === b.kind &&
  (a.kind !== ViewKind.Worktree ||
    (b.kind === ViewKind.Worktree && a.key === b.key)) &&
  (a.kind !== ViewKind.Conversation ||
    (b.kind === ViewKind.Conversation && a.id === b.id));
