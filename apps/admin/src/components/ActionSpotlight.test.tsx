import type { AdminActionListItemDto } from "@alliance/shared/client";
import { fireEvent, render, screen } from "@testing-library/react";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ActionSpotlight from "./ActionSpotlight";

const actions = [
  adminActionListItem(1, "Call your senator", {
    category: ["democracy"],
    status: "member_action",
    project: { id: 1, name: "Midterms", category: [] },
  }),
  adminActionListItem(2, "Plant trees", { category: ["environment"] }),
  adminActionListItem(3, "Vote early", { category: ["democracy"] }),
];

const renderSpotlight = (onPick = jest.fn()) => {
  render(
    <>
      <input aria-label="Other field" />
      <ActionSpotlight actions={actions} onPick={onPick} />
    </>,
  );
  return { onPick };
};

const type = (key: string, target: Element = document.body) =>
  fireEvent.keyDown(target, { key });

const input = () =>
  screen.getByRole<HTMLInputElement>("combobox", { name: "Search actions" });

const options = () =>
  screen.queryAllByRole("option").map((option) => option.textContent);

describe("ActionSpotlight", () => {
  it("opens on a printable key, seeded with that key", () => {
    renderSpotlight();
    expect(screen.queryByRole("dialog")).toBeNull();

    type("p");

    expect(input().value).toBe("p");
    expect(options()).toContain("Plant treesDraft");
  });

  it("opens empty on / and lists the used categories with counts", () => {
    renderSpotlight();
    type("/");

    expect(input().value).toBe("");
    expect(options()).toEqual(["Environment1", "Democracy2"]);
  });

  it.each([
    ["a modifier", { key: "k", metaKey: true }],
    ["a space", { key: " " }],
    ["a non-printable key", { key: "ArrowDown" }],
  ])("ignores %s", (_, init) => {
    renderSpotlight();
    fireEvent.keyDown(document.body, init);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves keys typed into a text field alone", () => {
    renderSpotlight();
    type("p", screen.getByRole("textbox", { name: "Other field" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("appends keys that land outside the input while open", () => {
    renderSpotlight();
    type("p");
    type("l");
    expect(input().value).toBe("pl");
  });

  it("scopes to a picked category, and Backspace on empty unscopes", () => {
    renderSpotlight();
    type("/");
    fireEvent.click(screen.getByText("Democracy"));

    expect(
      screen.getByRole("button", { name: "Remove Democracy filter" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(input());
    expect(
      options().some((text) => text?.startsWith("Call your senator")),
    ).toBe(true);
    expect(options().some((text) => text?.startsWith("Vote early"))).toBe(true);
    expect(options().some((text) => text?.startsWith("Plant trees"))).toBe(
      false,
    );

    fireEvent.keyDown(input(), { key: "Backspace" });

    expect(
      screen.queryByRole("button", { name: "Remove Democracy filter" }),
    ).toBeNull();
    expect(options()).toEqual(["Environment1", "Democracy2"]);
  });

  it("removes the category chip with its x button", () => {
    renderSpotlight();
    type("/");
    fireEvent.click(screen.getByText("Democracy"));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Democracy filter" }),
    );
    expect(options()).toEqual(["Environment1", "Democracy2"]);
  });

  it("lists matching categories above actions while typing", () => {
    renderSpotlight();
    type("d");
    fireEvent.change(input(), { target: { value: "democ" } });
    expect(options()[0]).toBe("Democracy2");
  });

  it("shows the status and project beside an action", () => {
    renderSpotlight();
    type("c");
    fireEvent.change(input(), { target: { value: "call" } });
    expect(options()).toEqual(["Call your senatorActiveMidterms"]);
  });

  it("says when nothing matches, and Enter does nothing", () => {
    const { onPick } = renderSpotlight();
    type("z");
    fireEvent.change(input(), { target: { value: "zzzz" } });

    expect(screen.getByText("No matching actions")).toBeTruthy();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onPick).not.toHaveBeenCalled();
  });

  it("picks the highlighted action with arrows and Enter, then closes", () => {
    const { onPick } = renderSpotlight();
    type("e");
    fireEvent.change(input(), { target: { value: "e" } });
    const firstAction = options().findIndex(
      (text) => text !== "Environment1" && text !== "Democracy2",
    );
    for (let i = 0; i < firstAction; i++) {
      fireEvent.keyDown(input(), { key: "ArrowDown" });
    }
    const highlighted = screen
      .getAllByRole("option")
      .find((option) => option.getAttribute("aria-selected") === "true");
    fireEvent.keyDown(input(), { key: "Enter" });

    const picked: AdminActionListItemDto = onPick.mock.calls[0][0];
    expect(highlighted?.textContent?.startsWith(picked.name)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape and discards the query", () => {
    renderSpotlight();
    type("p");
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    type("/");
    expect(input().value).toBe("");
  });
});
