import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import { PersonCell, PersonChip } from "./PersonCell";
import { linkClass, nameLinkClass } from "./styles";
import { Table, TableBody, TableRow } from "./Table";

afterEach(cleanup);

const inRow = (cell: React.ReactNode) =>
  render(
    <MemoryRouter>
      <Table>
        <TableBody>
          <TableRow>{cell}</TableRow>
        </TableBody>
      </Table>
    </MemoryRouter>,
  );

describe("PersonCell", () => {
  it("links the name to the member, whole in its title", () => {
    inRow(<PersonCell userId={12} name="Ada Lovelace" profilePicture={null} />);
    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Ada Lovelace",
    });
    expect(link.getAttribute("href")).toBe("/members/12");
    expect(link.title).toBe("Ada Lovelace");
    expect(link.className).toContain("truncate");
    expect(link.closest("td")).toBeTruthy();
  });

  it("reads as the row's name in the first column and as a link elsewhere", () => {
    inRow(
      <>
        <PersonCell userId={1} name="Ada" profilePicture={null} firstColumn />
        <PersonCell userId={2} name="Grace" profilePicture={null} />
      </>,
    );
    const classesOf = (name: string) =>
      screen.getByRole("link", { name }).className.split(" ");
    expect(classesOf("Ada")).toEqual(
      expect.arrayContaining(nameLinkClass.split(" ")),
    );
    expect(classesOf("Grace")).toEqual(
      expect.arrayContaining(linkClass.split(" ")),
    );
  });

  it("falls back to the member's number when they have no name", () => {
    inRow(
      <>
        <PersonCell userId={12} name={null} profilePicture={null} />
        <PersonCell userId={13} name="  " profilePicture={null} />
      </>,
    );
    expect(screen.getByRole("link", { name: "User #12" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "User #13" })).toBeTruthy();
  });
});

describe("PersonChip", () => {
  it("names the member without a link", () => {
    render(
      <PersonChip userId={12} name="Ada Lovelace" profilePicture={null} />,
    );
    expect(screen.getByText("Ada Lovelace").title).toBe("Ada Lovelace");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links the name to the member when asked", () => {
    render(
      <MemoryRouter>
        <PersonChip
          userId={12}
          name="Ada Lovelace"
          profilePicture={null}
          link
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole<HTMLAnchorElement>("link", {
      name: "Ada Lovelace",
    });
    expect(link.getAttribute("href")).toBe("/members/12");
    expect(link.title).toBe("Ada Lovelace");
    expect(link.className.split(" ")).toEqual(
      expect.arrayContaining([...linkClass.split(" "), "truncate"]),
    );
  });

  it("falls back to the member's number", () => {
    render(<PersonChip userId={12} name={undefined} profilePicture={null} />);
    expect(screen.getByText("User #12")).toBeTruthy();
  });
});
