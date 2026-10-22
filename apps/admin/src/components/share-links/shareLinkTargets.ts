import type { ShareUrlAdminDto } from "@alliance/shared/client/types.gen";

export type TargetKind = "action" | "external" | "invite";
export type PickableKind = Exclude<TargetKind, "invite">;

export type Target =
  | { kind: "action"; id: number; name: string }
  | { kind: "external"; id: number; name: string }
  | { kind: "invite" };

export const targetKey = (t: Target): string =>
  t.kind === "invite" ? "invite" : `${t.kind}-${t.id}`;

export const targetName = (t: Target): string =>
  t.kind === "invite" ? "Signup invite" : t.name;

export const targetKindLabel = (kind: TargetKind): string => {
  switch (kind) {
    case "action":
      return "Action";
    case "external":
      return "External target";
    case "invite":
      return "Invite (signup link)";
    default:
      throw new Error(`unknown target kind: ${kind satisfies never}`);
  }
};

export const targetSubtitle = (t: Target): string => {
  switch (t.kind) {
    case "action":
      return `Action #${t.id}`;
    case "external":
      return "External share target";
    case "invite":
      return "Signup invite link";
    default:
      throw new Error(`unknown target kind: ${t satisfies never}`);
  }
};

/** The target identity to send to the create-duplicate endpoint. */
export const targetColumns = (
  t: Target,
): { actionId?: number; externalTargetId?: number; invite?: true } => {
  switch (t.kind) {
    case "action":
      return { actionId: t.id };
    case "external":
      return { externalTargetId: t.id };
    case "invite":
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

export const groupShareLinks = (rows: ShareUrlAdminDto[]): ShareLinkGroup[] => {
  const byKey = new Map<string, ShareLinkGroup>();
  for (const row of rows) {
    let target: Target | null = null;
    if (row.action) {
      target = { kind: "action", id: row.action.id, name: row.action.name };
    } else if (row.externalTarget) {
      target = {
        kind: "external",
        id: row.externalTarget.id,
        name: row.externalTarget.name,
      };
    } else if (row.kind === "invite") {
      target = { kind: "invite" };
    }
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
