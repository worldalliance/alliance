import { fireEvent, screen } from "@testing-library/react";
import {
  ada,
  api,
  lee,
  north,
  renderPage,
  sam,
  serveGroupPageApi,
} from "./groupPageTesting";

serveGroupPageApi();

it("shows the saved details", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Northwest" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Northwest" }),
  ).toBeTruthy();
  expect(await screen.findByText("Saved")).toBeTruthy();
});

it("says why the details are invalid", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "   " },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Name is required")).toBeTruthy();
});

it("saves the details with the description cleared", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText(/^Description/), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Northwest" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Northwest" }),
  ).toBeTruthy();
});

it("saves a capacity below the member count", async () => {
  api.listed = { ...north, users: [sam, ada, lee] };
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByDisplayValue("10"), {
    target: { value: "1" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Group updated")).toBeTruthy();
});

it("puts back the saved details on Discard", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Northwest" },
  });
  expect(screen.getByText("Unsaved changes")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Discard" }));

  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("North");
});

it("keeps unsaved details when the group refetches with changes", async () => {
  const client = renderPage({ tab: "settings" });
  const description = await screen.findByLabelText(/^Description/);
  fireEvent.change(description, { target: { value: "Unsaved edit" } });

  api.listed = { ...north, description: "Newer details", users: [sam, ada] };
  await client.invalidateQueries();

  await screen.findByText(/^1 member ·/);
  expect(screen.getByDisplayValue("Unsaved edit")).toBeTruthy();
});

it("says why saving the details was refused, keeping the edit", async () => {
  api.updateStatus = 400;
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "South" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText(/That name is taken/)).toBeTruthy();
  expect(screen.getByDisplayValue("South")).toBeTruthy();
});

it("brings newer details into an untouched form when the refetch lands", async () => {
  api.listed = { ...north, description: "Fresh description" };
  renderPage({ tab: "settings", cached: [north] });

  expect(await screen.findByDisplayValue("Fresh description")).toBeTruthy();
});
