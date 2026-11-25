import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import {
  SortDirection,
  Table,
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
