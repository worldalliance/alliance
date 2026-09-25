import type {
  CreateExternalShareTargetDto,
  ExternalShareTargetDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
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
let loadGate = Promise.resolve();
let createGate = Promise.resolve();
let writeStatus = 200;

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
      const snapshot = stored;
      return loadGate.then(() => Response.json(snapshot));
    },
    "POST /external-share-targets": async ({ request }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      const body: CreateExternalShareTargetDto = await request.json();
      const created = { ...target(99, body.name), ...body };
      stored = [created, ...stored];
      return createGate.then(() => Response.json(created));
    },
    "PATCH /external-share-targets/:id": async ({ request, params }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      const body: CreateExternalShareTargetDto = await request.json();
      const updated = { ...target(Number(params.id), body.name), ...body };
      stored = stored.map((t) => (t.id === updated.id ? updated : t));
      return Response.json(updated);
    },
    "DELETE /external-share-targets/:id": ({ params }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      stored = stored.filter((t) => String(t.id) !== params.id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [target(1, "Partner A"), target(2, "Partner B")];
  loadStatus = 200;
  loadGate = Promise.resolve();
  createGate = Promise.resolve();
  writeStatus = 200;
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

it("lists a target created while the first load is in flight", async () => {
  let releaseLoad = () => {};
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  renderPage();
  createPartnerC();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseLoad();
  });

  expect(await screen.findByText("Partner C")).toBeTruthy();
  expect(screen.getByText("Partner A")).toBeTruthy();
});

it("lists a created target once when a refetch already returned it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Partner A");

  let releaseCreate = () => {};
  createGate = new Promise((resolve) => {
    releaseCreate = resolve;
  });
  createPartnerC();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await query.client.refetchQueries();
    releaseCreate();
  });

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy(),
  );
  expect(screen.getAllByText("Partner C")).toHaveLength(1);
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

it("keeps the delete when a refetch started before it lands after it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Partner A");

  let releaseLoad = () => {};
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  const refetch = query.client.refetchQueries();
  await deleteFirst();

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    releaseLoad();
    await refetch;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(
    query.client
      .getQueryData<
        ExternalShareTargetDto[]
      >(queryKeys.externalShareTargetsAdmin())
      ?.map((t) => t.id),
  ).toEqual([2]);
  expect(screen.queryByText("Partner A")).toBeNull();
});

it("keeps the target and says so when the delete fails", async () => {
  writeStatus = 500;
  renderPage();
  await deleteFirst();

  expect(
    await screen.findByText("Unable to delete share target."),
  ).toBeTruthy();
  expect(screen.getByText("Partner A")).toBeTruthy();
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
