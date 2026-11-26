import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import {
  SortDirection,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./Table";

afterEach(cleanup);

describe("TableHead sort", () => {
  it("marks the sorted column, arrows only it, and sorts on press", () => {
    const onSort = jest.fn();
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead sort={{ direction: SortDirection.Descending, onSort }}>
              Signed up
            </TableHead>
            <TableHead sort={{ direction: null, onSort: jest.fn() }}>
              Name
            </TableHead>
            <TableHead>Time zone</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const [signedUp, name, zone] = screen.getAllByRole("columnheader");
    expect(signedUp?.getAttribute("aria-sort")).toBe("descending");
    expect(name?.getAttribute("aria-sort")).toBe("none");
    expect(zone?.hasAttribute("aria-sort")).toBe(false);
    expect(signedUp?.querySelector("svg")).not.toBeNull();
    expect(name?.querySelector("svg")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Signed up" }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });
});

describe("Table stickyActions", () => {
  const rect = (left: number, right: number) => () =>
    DOMRect.fromRect({ x: left, width: right - left, y: 0, height: 10 });

  it("scrolls a focused control out from under the pinned actions", () => {
    const { container } = render(
      <div>
        <Table stickyActions>
          <TableBody>
            <TableRow>
              <TableCell>
                <button type="button">Referrer</button>
              </TableCell>
              <TableCell actions>
                <button type="button">Edit</button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>,
    );
    const scroller = container.firstElementChild;
    if (!(scroller instanceof HTMLElement)) throw new Error("no scroller");
    Object.defineProperties(scroller, {
      scrollWidth: { value: 900 },
      clientWidth: { value: 600 },
    });
    const scrollBy = jest.fn();
    scroller.scrollBy = scrollBy;
    const referrer = screen.getByRole("button", { name: "Referrer" });
    referrer.getBoundingClientRect = rect(480, 560);
    const edit = screen.getByRole("button", { name: "Edit" });
    const actions = edit.closest("td");
    if (!actions) throw new Error("no actions cell");
    actions.getBoundingClientRect = rect(520, 600);

    edit.focus();
    expect(scrollBy).not.toHaveBeenCalled();
    referrer.focus();
    expect(scrollBy).toHaveBeenCalledWith({ left: 44 });

    scrollBy.mockClear();
    referrer.getBoundingClientRect = rect(400, 500);
    edit.focus();
    referrer.focus();
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
