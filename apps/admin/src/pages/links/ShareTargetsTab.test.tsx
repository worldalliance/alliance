import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { ToastProvider } from "../../ui/ToastProvider";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ShareTargetsTab } from "./ShareTargetsTab";

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
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/growth/links?tab=share-targets"]}>
      <ToastProvider>
        <ShareTargetsTab />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const deleteFirst = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete: Partner A" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete share target" }),
  );
};

const saveFirstAs = async (name: string) => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Partner A" }),
  );
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByDisplayValue("Partner A"), {
    target: { value: name },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
  return dialog;
};

const createPartnerC = () => {
  const name = screen.getByPlaceholderText("Partner X signup");
  fireEvent.change(name, { target: { value: "Partner C" } });
  fireEvent.change(screen.getByPlaceholderText("https://example.com/route"), {
    target: { value: "https://example.com/c" },
  });
  fireEvent.change(screen.getByPlaceholderText("code"), {
    target: { value: "ref" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create share target" }));
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

it("keeps the form read-only while the create runs", async () => {
  let release = () => {};
  writeGate = new Promise((resolve) => (release = resolve));
  renderPage();
  await screen.findByText("Partner A");

  const name = createPartnerC();

  await waitFor(() => expect(name).toHaveProperty("readOnly", true));
  release();
  expect(await screen.findByText("Partner C")).toBeTruthy();
  expect(name).toHaveProperty("readOnly", false);
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

  expect(await screen.findByRole("cell", { name: "Partner Z" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it("marks the save busy until the save lands", async () => {
  let release = () => {};
  writeGate = new Promise((resolve) => (release = resolve));
  renderPage();
  const dialog = await saveFirstAs("Partner Z");

  const saving = within(dialog).getByRole("button", { name: "Save changes" });
  await waitFor(() => expect(saving.getAttribute("aria-busy")).toBe("true"));
  release();
  expect(await screen.findByRole("cell", { name: "Partner Z" })).toBeTruthy();
});

it("stays in edit mode and shows the refusal when the save fails", async () => {
  writeStatus = 404;
  renderPage();
  const dialog = await saveFirstAs("Partner Z");

  expect(await within(dialog).findByText("Refused by the server")).toBeTruthy();
  expect(within(dialog).getByDisplayValue("Partner Z")).toBeTruthy();
  expect(stored.map((t) => t.name)).toEqual(["Partner A", "Partner B"]);
});

it("asks before moving where the target's links go", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Partner A" }),
  );
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByDisplayValue("https://example.com/1"), {
    target: { value: "https://example.com/new" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
  fireEvent.click(await screen.findByRole("button", { name: "Change link" }));

  await waitFor(() => expect(stored[0].url).toBe("https://example.com/new"));
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

  const deleting = screen.getByRole("button", { name: "Delete: Partner A" });
  await waitFor(() => expect(deleting.getAttribute("aria-busy")).toBe("true"));
  expect(
    screen
      .getByRole("button", { name: "Delete: Partner B" })
      .getAttribute("aria-busy"),
  ).toBeNull();
  release();
  await waitForElementToBeRemoved(() => screen.queryByText("Partner A"));
});

it("keeps the target and says so when the delete fails", async () => {
  writeStatus = 500;
  renderPage();
  await deleteFirst();

  expect(await screen.findByText("Couldn't delete “Partner A”.")).toBeTruthy();
  expect(screen.getByText("Partner A")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("button", { name: /^Delete: / })
        .map((b) => b.getAttribute("aria-busy")),
    ).toEqual([null, null]),
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
  expect(await screen.findByText("Couldn't load share targets")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No share targets yet")).toBeNull();
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
    expect(screen.getByText(/Couldn't refresh share targets/)).toBeTruthy(),
  );
  expect(screen.getByText("Partner A")).toBeTruthy();
});
