import { expect, test } from "bun:test";
import { nameBase } from "./worktree";

test("nameBase joins the typed words with dashes, in lowercase", () => {
  expect(nameBase("Fix the Signup page's copy!")).toBe(
    "fix-the-signup-page-s-copy",
  );
  expect(nameBase("fix-login")).toBe("fix-login");
});

test("nameBase stops at a whole word before 37 characters", () => {
  const name = nameBase(
    "Make the admin panel's member list sortable by every single column",
  );
  expect(name).toBe("make-the-admin-panel-s-member-list");
  expect(name.length).toBeLessThanOrEqual(37);
});

test("nameBase cuts a first word longer than the limit", () => {
  expect(nameBase("a".repeat(60))).toBe("a".repeat(37));
});

test("nameBase drops accents, and is empty for text with no letter from a to z or digit", () => {
  expect(nameBase("Café menu")).toBe("cafe-menu");
  expect(nameBase("Résumé parser")).toBe("resume-parser");
  expect(nameBase("¿¡…!?")).toBe("");
  expect(nameBase("Исправить вход")).toBe("");
  expect(nameBase("øæ")).toBe("");
});
