import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useRef, useState } from "react";
import { useFocusAfterRemoval } from "./useFocusAfterRemoval";

afterEach(cleanup);

function List({ initial }: { initial: string[] }) {
  const [ids, setIds] = useState(initial);
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useFocusAfterRemoval({ ids, fallback: addRef });
  return (
    <>
      <ul>
        {ids.map((id) => (
          <li key={id} {...focus.row(id)}>
            <button
              type="button"
              onClick={() => {
                focus.removing(id)();
                setIds((prev) => prev.filter((other) => other !== id));
              }}
            >
              Remove {id}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" ref={addRef}>
        Add
      </button>
    </>
  );
}

const remove = (id: string) =>
  act(() =>
    fireEvent.click(screen.getByRole("button", { name: `Remove ${id}` })),
  );

describe("useFocusAfterRemoval", () => {
  it("focuses the next row, else the previous, else the fallback", () => {
    render(<List initial={["a", "b", "c"]} />);
    remove("b");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove c" }),
    );
    remove("c");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove a" }),
    );
    remove("a");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add" }),
    );
  });

  it("scrolls the neighbour into view the least, not with focus's jump", () => {
    const scrolled = jest.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrolled;
    try {
      render(<List initial={["a", "b"]} />);
      remove("b");
      expect(scrolled).toHaveBeenCalledTimes(1);
      expect(scrolled.mock.calls[0]?.[0]).toMatchObject({ block: "nearest" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("waits for a neighbour that is listed but not yet rendered", async () => {
    function Late() {
      const [shown, setShown] = useState(false);
      const fallback = useRef<HTMLButtonElement>(null);
      const focus = useFocusAfterRemoval({ ids: ["a", "b"], fallback });
      return (
        <>
          {shown && (
            <div {...focus.row("b")}>
              <button type="button">Remove b</button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              focus.removing("a")();
              setTimeout(() => setShown(true));
            }}
          >
            Remove a
          </button>
          <button type="button" ref={fallback}>
            Add
          </button>
        </>
      );
    }
    render(<Late />);
    remove("a");
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove b" }),
    );
  });

  it("falls back when the neighbour it chose is removed too", () => {
    function Batch() {
      const [ids, setIds] = useState(["a", "b"]);
      const fallback = useRef<HTMLButtonElement>(null);
      const focus = useFocusAfterRemoval({ ids, fallback });
      return (
        <>
          {ids.map((id) => (
            <div key={id} {...focus.row(id)}>
              <button
                type="button"
                onClick={() => {
                  focus.removing(id)();
                  setIds([]);
                }}
              >
                Remove {id}
              </button>
            </div>
          ))}
          <button type="button" ref={fallback}>
            Add
          </button>
        </>
      );
    }
    render(<Batch />);
    remove("a");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add" }),
    );
  });
});
