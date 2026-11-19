import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, mock } from "bun:test";
import { MemoryRouter } from "react-router";
import PageShell from "./PageShell";

it("renders one page heading, a back link and the page body", () => {
  render(
    <MemoryRouter>
      <PageShell title="Groups" back={{ to: "/", label: "Stats" }}>
        <p>Body</p>
      </PageShell>
    </MemoryRouter>,
  );

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Stats" }).getAttribute("href")).toBe(
    "/",
  );
  expect(screen.getByText("Body")).toBeTruthy();
  expect(document.title).toBe("Groups - Admin");
});

it("puts menu commands behind More, destructive ones last", async () => {
  const archive = mock();
  const remove = mock();
  const duplicate = mock();
  render(
    <MemoryRouter>
      <PageShell
        title="Action"
        menu={[
          { label: "Delete", onSelect: remove, destructive: true },
          { label: "Archive", onSelect: archive },
          {
            label: "Duplicate",
            onSelect: duplicate,
            disabledReason: "Save your changes first.",
          },
        ]}
      >
        <p>Body</p>
      </PageShell>
    </MemoryRouter>,
  );

  expect(screen.queryByRole("menuitem")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "More" }));

  const items = await screen.findAllByRole("menuitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "Archive",
    "DuplicateSave your changes first.",
    "Delete",
  ]);
  expect(items[1].getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(items[1]);
  expect(duplicate).not.toHaveBeenCalled();
  fireEvent.click(items[0]);
  expect(archive).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
});

it("shows no More button without menu commands", () => {
  render(
    <MemoryRouter>
      <PageShell title="Groups" menu={[]}>
        <p>Body</p>
      </PageShell>
    </MemoryRouter>,
  );

  expect(screen.queryByRole("button", { name: "More" })).toBeNull();
  expect(screen.getByRole("banner").textContent).toBe("Groups");
});
