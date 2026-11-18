import { expect, test } from "bun:test";
import { type Route, fail, useFakeGh } from "../fake-gh";
import { COMMIT, NEWER, deployments } from "./fixtures";

const fakeGh = useFakeGh();

const state = (id: number, response: unknown): Route => ({
  match: `/deployments/${id}/statuses?`,
  response,
});

const live = (routes: Route[]) =>
  fakeGh({
    command: [`${import.meta.dir}/live-commit.sh`, "production"],
    routes: [...routes, deployments("production-live")],
  });

test("prints the newest successful production-live deployment's commit", () => {
  const result = live([
    deployments("production-live", [11, COMMIT], [10, NEWER], [9, COMMIT]),
    state(11, [{ state: "failure" }]),
    state(10, [{ state: "success" }]),
    state(9, [{ state: "success" }]),
  ]);
  expect(result.stdout).toBe(`${NEWER}\n`);
  expect(result.calls).toContain(
    "repos/o/r/deployments?environment=production-live&per_page=100",
  );
  expect(result.calls).not.toContain("deployments/9/statuses");
});

test("prints nothing when no deployment succeeded", () => {
  const result = live([
    deployments("production-live", [9, COMMIT]),
    state(9, [{ state: "in_progress" }]),
  ]);
  expect([result.code, result.stdout]).toEqual([0, ""]);
});

test("prints nothing when the environment has no deployments", () => {
  const result = live([]);
  expect([result.code, result.stdout]).toEqual([0, ""]);
  expect(result.calls).not.toContain("/statuses");
});

test("fails when a status lookup fails", () => {
  const result = live([
    deployments("production-live", [9, COMMIT]),
    fail("/deployments/9/statuses?"),
  ]);
  expect(result.code).not.toBe(0);
});

test("fails when the deployments lookup fails", () => {
  const result = live([fail("/deployments?")]);
  expect(result.code).not.toBe(0);
});
