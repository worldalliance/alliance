import { beforeEach, describe, expect, it } from "bun:test";
import {
  readOpenFolders,
  SidebarFolder,
  writeOpenFolders,
} from "./sidebarFolders";

const STORAGE_KEY = "alliance.admin.sidebarOpenFolders.v1";

describe("sidebar folder persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts with every folder closed", () => {
    expect(readOpenFolders()).toEqual(new Set());
  });

  it("round-trips the open folders", () => {
    writeOpenFolders(
      new Set([SidebarFolder.Community, SidebarFolder.Outreach]),
    );
    expect(readOpenFolders()).toEqual(
      new Set([SidebarFolder.Community, SidebarFolder.Outreach]),
    );
  });

  it("drops folders that no longer exist", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["content", "extras"]),
    );
    expect(readOpenFolders()).toEqual(new Set([SidebarFolder.Content]));
  });

  it("ignores malformed storage", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(readOpenFolders()).toEqual(new Set());
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }));
    expect(readOpenFolders()).toEqual(new Set());
  });
});
