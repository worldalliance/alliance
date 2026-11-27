import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { useSidebarCollapsed } from "./sidebarCollapsed";

beforeEach(() => window.localStorage.clear());

it("starts expanded", () => {
  const { result } = renderHook(() => useSidebarCollapsed());
  expect(result.current[0]).toBe(false);
});

it("remembers the collapsed state for the next visit", () => {
  const first = renderHook(() => useSidebarCollapsed());
  act(() => first.result.current[1](true));
  first.unmount();
  const collapsed = renderHook(() => useSidebarCollapsed());
  expect(collapsed.result.current[0]).toBe(true);

  act(() => collapsed.result.current[1](false));
  collapsed.unmount();
  expect(renderHook(() => useSidebarCollapsed()).result.current[0]).toBe(false);
});

it("starts expanded when site data is blocked", () => {
  const storage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => {
      throw new Error("SecurityError");
    },
  });
  try {
    const { result } = renderHook(() => useSidebarCollapsed());
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  } finally {
    if (storage) Object.defineProperty(window, "localStorage", storage);
  }
});
