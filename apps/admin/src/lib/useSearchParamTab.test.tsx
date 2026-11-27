import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useSearchParams } from "react-router";
import { useSearchParamTab } from "./useSearchParamTab";

const tabs = ["details", "content"] as const;

function mount(url: string) {
  const view = renderHook(
    () => ({
      tab: useSearchParamTab(tabs, "details"),
      params: useSearchParams()[0],
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
      ),
    },
  );
  return () => view.result.current;
}

test("reads a known tab from the URL", () => {
  expect(mount("/?tab=content")().tab[0]).toBe("content");
});

test("falls back when the URL names no tab or an unknown one", () => {
  expect(mount("/")().tab[0]).toBe("details");
  expect(mount("/?tab=bogus")().tab[0]).toBe("details");
});

const mountHook = <R,>(url: string, hook: () => R) =>
  renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
    ),
  }).result.current;

test("links to a tab keep other params, dropping those the old tab owns", () => {
  const href = mountHook("/?tab=details&view=a&suiteId=3", () =>
    useSearchParamTab(tabs, "details", { resets: ["view"] }),
  )[2];
  expect(href("content")).toBe("?tab=content&suiteId=3");
  expect(href("details")).toBe("?tab=details&view=a&suiteId=3");
});

test("a link to the fallback tab shown without a param keeps its params", () => {
  const href = mountHook("/?view=a", () =>
    useSearchParamTab(tabs, "details", { resets: ["view"] }),
  )[2];
  expect(href("details")).toBe("?view=a&tab=details");
});

test("reads and links a tab kept under another param", () => {
  const [selected, , href] = mountHook("/?tab=x&view=content", () =>
    useSearchParamTab(tabs, "details", { param: "view" }),
  );
  expect(selected).toBe("content");
  expect(href("details")).toBe("?tab=x&view=details");
});

test("switching tabs keeps the other search params", () => {
  const current = mount("/?tab=details&suiteId=3");
  act(() => current().tab[1]("content"));
  expect(current().tab[0]).toBe("content");
  expect(current().params.get("suiteId")).toBe("3");
});
