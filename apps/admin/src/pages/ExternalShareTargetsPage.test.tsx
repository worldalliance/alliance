import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import ExternalShareTargetsPage from "./ExternalShareTargetsPage";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const target = (id: number, name: string) =>
  ({
    id,
    name,
    url: `https://example.com/${id}`,
    paramName: "code",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }) satisfies ExternalShareTargetDto;

let stored: ExternalShareTargetDto[] = [];
let loadStatus = 200;
let writeStatus = 200;
let writeGate = Promise.resolve();

const refusal = (status: number) =>
  Response.json(
    { message: "Refused by the server", statusCode: status },
    {
      status,
    },
  );

serveApi(
  routes({
    "GET /external-share-targets": () => {
      if (loadStatus !== 200) return Response.json({}, { status: loadStatus });
      return Response.json(stored);
    },
    "POST /external-share-targets": async ({ request }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      const body: CreateExternalShareTargetDto = await request.json();
      const created = { ...target(99, body.name), ...body };
      stored = [created, ...stored];
      return Response.json(created);
    },
    "PATCH /external-share-targets/:id": async ({ request, params }) => {
      await writeGate;
      if (writeStatus !== 200) return refusal(writeStatus);
      const body: CreateExternalShareTargetDto = await request.json();
      const updated = { ...target(Number(params.id), body.name), ...body };
      stored = stored.map((t) => (t.id === updated.id ? updated : t));
      return Response.json(updated);
    },
    "DELETE /external-share-targets/:id": async ({ params }) => {
      await writeGate;
      if (writeStatus !== 200) return refusal(writeStatus);
      stored = stored.filter((t) => String(t.id) !== params.id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [target(1, "Partner A"), target(2, "Partner B")];
  loadStatus = 200;
  writeStatus = 200;
  writeGate = Promise.resolve();
  jest.spyOn(window, "confirm").mockReturnValue(true);
});

const renderPage = (query = queryWrapper()) =>
  render(<ExternalShareTargetsPage />, query);

const deleteFirst = async () => {
  const [first] = await screen.findAllByRole("button", { name: "Delete" });
  fireEvent.click(first);
};

const saveFirstAs = async (name: string) => {
  const [first] = await screen.findAllByRole("button", { name: "Edit" });
  fireEvent.click(first);
  fireEvent.change(screen.getByDisplayValue("Partner A"), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
};

const createPartnerC = () => {
  const name = screen.getByPlaceholderText(
    "Internal label, e.g. Partner X signup",
  );
  fireEvent.change(name, { target: { value: "Partner C" } });
  fireEvent.change(screen.getByPlaceholderText("https://example.com/route"), {
    target: { value: "https://example.com/c" },
  });
  fireEvent.change(screen.getByPlaceholderText("code"), {
    target: { value: "ref" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  return name;
};

it("lists the loaded targets", async () => {
  renderPage();
  expect(await screen.findByText("Partner A")).toBeTruthy();
  expect(screen.getByText("Partner B")).toBeTruthy();
});

it("adds a created target to the list and clears the form", async () => {
  renderPage();
  await screen.findByText("Partner A");

  const name = createPartnerC();

  expect(await screen.findByText("Partner C")).toBeTruthy();
  expect(name).toHaveProperty("value", "");
});

it("keeps the form and shows the refusal when the create fails", async () => {
  writeStatus = 400;
  renderPage();
  await screen.findByText("Partner A");

  const name = createPartnerC();

  expect(await screen.findByText("Refused by the server")).toBeTruthy();
  expect(name).toHaveProperty("value", "Partner C");
});

it("shows a saved target and leaves edit mode", async () => {
  renderPage();
  await saveFirstAs("Partner Z");

  expect(await screen.findByText("Partner Z")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

it("marks the row saving until the save lands", async () => {
  let release = () => {};
  writeGate = new Promise((resolve) => (release = resolve));
  renderPage();
  await saveFirstAs("Partner Z");

  const saving = await screen.findByRole("button", { name: "Saving…" });
  expect(saving.hasAttribute("disabled")).toBe(true);
  release();
  expect(await screen.findByText("Partner Z")).toBeTruthy();
});

it("stays in edit mode and shows the refusal when the save fails", async () => {
  writeStatus = 404;
  renderPage();
  await saveFirstAs("Partner Z");

  expect(await screen.findByText("Refused by the server")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  expect(screen.getByText("Partner A")).toBeTruthy();
});

it("removes a deleted target from the list", async () => {
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("Partner A"));
  expect(stored.map((t) => t.id)).toEqual([2]);
});

it("marks the row deleting until the delete lands", async () => {
  let release = () => {};
  writeGate = new Promise((resolve) => (release = resolve));
  renderPage();
  await deleteFirst();

  const deleting = await screen.findByRole("button", { name: "Deleting…" });
  expect(deleting.hasAttribute("disabled")).toBe(true);
  release();
  await waitForElementToBeRemoved(() => screen.queryByText("Partner A"));
});

it("keeps the target and says so when the delete fails", async () => {
  writeStatus = 500;
  renderPage();
  await deleteFirst();

  expect(
    await screen.findByText("Unable to delete share target."),
  ).toBeTruthy();
  expect(screen.getByText("Partner A")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("button", { name: "Delete" })
        .map((b) => b.hasAttribute("disabled")),
    ).toEqual([false, false]),
  );
});

it("drops a target another admin already deleted", async () => {
  writeStatus = 404;
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("Partner A"));
  expect(screen.queryByText("Refused by the server")).toBeNull();
});

it("says the targets failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load share targets.")).toBeTruthy();
  expect(screen.queryByText("No share targets yet.")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded targets beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Partner A");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  await waitFor(() =>
    expect(screen.getByText("Failed to load share targets.")).toBeTruthy(),
  );
  expect(screen.getByText("Partner A")).toBeTruthy();
});
