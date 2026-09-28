import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useSearchParams } from "react-router";
import { useSearchParamTab } from "./useSearchParamTab";

afterEach(cleanup);

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

test("switching tabs keeps the other search params", () => {
  const current = mount("/?tab=details&suiteId=3");
  act(() => current().tab[1]("content"));
  expect(current().tab[0]).toBe("content");
  expect(current().params.get("suiteId")).toBe("3");
});
