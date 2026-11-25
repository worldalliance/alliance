import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";

export enum TargetKind {
  Task = "action",
  External = "external",
  Invite = "invite",
}

export type Target =
  | { kind: TargetKind.Task; id: number; name: string }
  | { kind: TargetKind.External; id: number; name: string }
  | { kind: TargetKind.Invite };

export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  [TargetKind.Task]: "Task",
  [TargetKind.External]: "Share target",
  [TargetKind.Invite]: "Signup invite",
};

export const targetKey = (t: Target): string =>
  t.kind === TargetKind.Invite ? "invite" : `${t.kind}-${t.id}`;

export const targetName = (t: Target): string =>
  t.kind === TargetKind.Invite ? "Signup invite" : t.name;

export const targetSubtitle = (t: Target): string => {
  switch (t.kind) {
    case TargetKind.Task:
      return `Task ${t.id}`;
    case TargetKind.External:
      return "Share target";
    case TargetKind.Invite:
      return "Signup link";
    default:
      throw new Error(`unknown target kind: ${t satisfies never}`);
  }
};

export const targetColumns = (
  t: Target,
): { actionId?: number; externalTargetId?: number; invite?: true } => {
  switch (t.kind) {
    case TargetKind.Task:
      return { actionId: t.id };
    case TargetKind.External:
      return { externalTargetId: t.id };
    case TargetKind.Invite:
      return { invite: true };
    default:
      throw new Error(`unknown target kind: ${t satisfies never}`);
  }
};

export type ShareLinkGroup = {
  key: string;
  target: Target;
  rows: ShareUrlAdminDto[];
  duplicateCount: number;
  mostRecent: number;
};

const rowTarget = (row: ShareUrlAdminDto): Target | null => {
  if (row.action) {
    return { kind: TargetKind.Task, id: row.action.id, name: row.action.name };
  }
  if (row.externalTarget) {
    return {
      kind: TargetKind.External,
      id: row.externalTarget.id,
      name: row.externalTarget.name,
    };
  }
  return row.kind === "invite" ? { kind: TargetKind.Invite } : null;
};

/** Links by target, newest group first; in a group the original, then duplicates oldest first. */
export const groupShareLinks = (rows: ShareUrlAdminDto[]): ShareLinkGroup[] => {
  const byKey = new Map<string, ShareLinkGroup>();
  for (const row of rows) {
    const target = rowTarget(row);
    if (!target) continue;
    const key = targetKey(target);
    const existing = byKey.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      byKey.set(key, {
        key,
        target,
        rows: [row],
        duplicateCount: 0,
        mostRecent: 0,
      });
    }
  }
  for (const group of byKey.values()) {
    group.rows.sort((a, b) => {
      if (a.duplicate !== b.duplicate) return a.duplicate ? 1 : -1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    group.duplicateCount = group.rows.filter((r) => r.duplicate).length;
    group.mostRecent = group.rows.reduce(
      (acc, r) => Math.max(acc, new Date(r.createdAt).getTime()),
      0,
    );
  }
  return [...byKey.values()].sort((a, b) => b.mostRecent - a.mostRecent);
};
