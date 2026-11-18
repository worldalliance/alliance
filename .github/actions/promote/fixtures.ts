import { readFileSync } from "node:fs";
import { type Route, useFakeGh } from "../fake-gh";

export const COMMIT = "c".repeat(40);
export const REQUIRED = [
  ...readFileSync(`${import.meta.dir}/promote.sh`, "utf8")
    .match(/^REQUIRED=\(\n([^)]*)\n\)/m)![1]
    .matchAll(/"([^"]+)"/g),
].map((match) => match[1]);

export function usePromote() {
  const fakeGh = useFakeGh();
  return (params: { routes: Route[]; env?: Record<string, string> }) =>
    fakeGh({
      command: [`${import.meta.dir}/promote.sh`],
      routes: params.routes,
      env: { COMMIT, ...params.env },
    });
}

export const run = (id: number) => ({
  id,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
});

export const jobs = (overrides: Record<string, string | null> = {}) => ({
  jobs: [
    ...REQUIRED.map((name) => ({
      name,
      status: overrides[name] === null ? "in_progress" : "completed",
      conclusion: name in overrides ? overrides[name] : "success",
    })),
    {
      name: "deploy / publish-mobile-ota / publish-mobile-ota",
      status: "completed",
      conclusion: "failure",
    },
  ],
});

export const ARTIFACT_NAMES = [
  "react-build",
  "react-assets",
  "admin-build",
  "deployed-config",
];
export const artifacts = (expired: string[] = [], names = ARTIFACT_NAMES) => ({
  artifacts: names.map((name, i) => ({
    name,
    id: 100 + i,
    expired: expired.includes(name),
  })),
});
