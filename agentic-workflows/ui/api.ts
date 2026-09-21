import type {
  CommitDiff,
  Job,
  JobStep,
  PanelState,
  RunMode,
  WorktreeDetail,
} from "../src/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    const parsed = text.startsWith("{") ? JSON.parse(text) : null;
    throw new Error(parsed?.error ?? text ?? response.statusText);
  }

  return JSON.parse(text);
}

function post<T>(url: string, input: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export const api = {
  state: () => request<PanelState>("/api/state"),
  detail: (input: { path: string; base: string }) =>
    request<WorktreeDetail>(`/api/worktree?${new URLSearchParams(input)}`),
  messages: (input: { job: string; step: string }) =>
    request<unknown[]>(`/api/messages?${new URLSearchParams(input)}`),
  workflow: (input: { path: string; remote: string }) =>
    request<JobStep[]>(`/api/workflow?${new URLSearchParams(input)}`),
  diff: (input: { path: string; oldest: string; newest: string }) =>
    request<CommitDiff>(`/api/diff?${new URLSearchParams(input)}`),
  createWorktree: (input: { name: string; from: string | null }) =>
    post<Job>("/api/worktrees", input),
  removeWorktree: (path: string) =>
    post<Job>("/api/worktrees/remove", { path }),
  reviewBase: (input: { path: string; remote: string; mode: RunMode }) =>
    post<Job>("/api/review-base", input),
  stepJob: (id: string) => post<Job>("/api/jobs/step", { id }),
  cancelJob: (id: string) => post<{ ok: true }>("/api/jobs/cancel", { id }),
};
