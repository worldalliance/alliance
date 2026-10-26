import { renderHook, waitFor } from "@testing-library/react/pure";
import { useEffect } from "react";

it("prints a DOM node in a failed expectation as its markup", () => {
  const node = document.createElement("div");
  node.setAttribute("role", "group");

  expect(() => expect(node).toBeNull()).toThrow(
    'Received: <div role="group"></div>',
  );
});

let mounted = false;

it("renders a hook and leaves it to the shared cleanup", () => {
  renderHook(() =>
    useEffect(() => {
      mounted = true;
      return () => {
        mounted = false;
      };
    }, []),
  );
  expect(mounted).toBe(true);
});

it("unmounts what the previous test rendered", () => {
  expect(mounted).toBe(false);
});

describe("a spy and an unmount effect", () => {
  const clock = { read: () => "real" };
  let readOnUnmount: string | undefined;

  beforeEach(() => {
    jest.spyOn(clock, "read").mockReturnValue("spied");
  });

  it("renders a hook that reads the clock when it unmounts", () => {
    renderHook(() =>
      useEffect(() => () => void (readOnUnmount = clock.read()), []),
    );
  });

  it("unmounts it before the spies are restored", () => {
    expect(readOnUnmount).toBe("spied");
  });
});

describe("a clipboard stub", () => {
  it("replaces the clipboard", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
  });

  it("is gone in the next test", () => {
    expect(navigator.clipboard.writeText).toBeInstanceOf(Function);
  });
});

describe("fake timers", () => {
  it("are switched on and back off", () => {
    jest.useFakeTimers();
    jest.useRealTimers();
  });

  it("leave waitFor polling real time in the next test", async () => {
    let ready = false;
    setTimeout(() => (ready = true), 10);

    await waitFor(() => expect(ready).toBe(true));
  });
});
