import { test } from "@playwright/test";
import path from "node:path";

// Each test gets its own profile, so none touches the developer's or another test's.
export function appArgs(): string[] {
  return [
    path.join(import.meta.dirname, ".."),
    `--user-data-dir=${test.info().outputPath("user-data")}`,
  ];
}
