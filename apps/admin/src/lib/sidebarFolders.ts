import { R } from "@alliance/common/result";
import { z } from "zod";

export enum SidebarFolder {
  ActionPlanning = "action-planning",
  Activity = "activity",
  InvitesSharing = "invites-sharing",
  Community = "community",
  Outreach = "outreach",
  Content = "content",
}

const STORAGE_KEY = "alliance.admin.sidebarOpenFolders.v1";

const folderSchema = z.enum(SidebarFolder);

export function readOpenFolders(): Set<SidebarFolder> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return new Set();
  const parsed = R.fromThrowable(() => JSON.parse(raw));
  if (!parsed.ok || !Array.isArray(parsed.value)) return new Set();
  return new Set(
    parsed.value.flatMap((value: unknown) => {
      const folder = folderSchema.safeParse(value);
      return folder.success ? [folder.data] : [];
    }),
  );
}

export function writeOpenFolders(folders: ReadonlySet<SidebarFolder>): void {
  if (typeof window === "undefined") return;
  R.fromThrowable(() =>
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...folders])),
  );
}
