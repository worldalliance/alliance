import type {
  ActionPartnershipNoteDto,
  ActionPartnershipResponseDto,
  CreateActionPartnershipNoteDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import OutreachPartnershipsPage from "./OutreachPartnershipsPage";

const partnership = (id: number, organizationName: string) =>
  ({
    id,
    organizationName,
    organizationWebsite: "",
    personName: "Sam Example",
    contact: `org${id}@example.com`,
    outreachChannels: ["Newsletter"],
    outreachOtherDetails: "",
    audienceSize: "100",
    desiredCollaboration: "Share the action",
    notes: "",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    notesHistory: [],
  }) satisfies ActionPartnershipResponseDto;

const note = (id: number, responseId: number) =>
  ({
    id,
    responseId,
    noteDate: "2026-01-03T00:00:00.000Z",
    body: "Earlier note",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  }) satisfies ActionPartnershipNoteDto;

let stored: ActionPartnershipResponseDto[] = [];
let loadStatus = 200;
let loadGate = Promise.resolve();
let noteGate = Promise.resolve();
let writeStatus = 200;

const refusal = (status: number) =>
  Response.json(
    { message: "Refused by the server", statusCode: status },
    { status },
  );

serveApi(
  routes({
    "GET /action-partnerships/responses": () => {
      if (loadStatus !== 200) return Response.json({}, { status: loadStatus });
      const snapshot = stored;
      return loadGate.then(() => Response.json(snapshot));
    },
    "POST /action-partnerships/responses/:id/notes": async ({
      request,
      params,
    }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      const body: CreateActionPartnershipNoteDto = await request.json();
      const note = {
        id: 50,
        responseId: Number(params.id),
        noteDate: body.noteDate ?? "2026-01-03T00:00:00.000Z",
        body: body.body,
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      } satisfies ActionPartnershipNoteDto;
      stored = stored.map((r) =>
        r.id === note.responseId
          ? { ...r, notesHistory: [note, ...r.notesHistory] }
          : r,
      );
      return noteGate.then(() => Response.json(note));
    },
    "DELETE /action-partnerships/responses/:id": ({ params }) => {
      if (writeStatus !== 200) return refusal(writeStatus);
      stored = stored.filter((r) => String(r.id) !== params.id);
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [partnership(1, "Org A"), partnership(2, "Org B")];
  loadStatus = 200;
  loadGate = Promise.resolve();
  noteGate = Promise.resolve();
  writeStatus = 200;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/growth/partnerships"]}>
      <ToastProvider>
        <OutreachPartnershipsPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

const deleteFirst = async () => {
  const [first] = await screen.findAllByRole("button", { name: /^Delete: / });
  fireEvent.click(first);
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete response" }),
  );
};

const noteFirst = async (body: string) => {
  const [first] = await screen.findAllByPlaceholderText(
    "Follow-up status, next step, context...",
  );
  fireEvent.change(first, { target: { value: body } });
  const [save] = screen.getAllByRole("button", { name: "Save note" });
  fireEvent.click(save);
  return first;
};

const cachedIds = (query: ReturnType<typeof queryWrapper>) =>
  query.client
    .getQueryData<
      ActionPartnershipResponseDto[]
    >(queryKeys.outreachPartnershipResponsesAdmin())
    ?.map((r) => r.id);

it("lists the loaded responses", async () => {
  renderPage();
  expect(await screen.findByText("Org A")).toBeTruthy();
  expect(screen.getByText("Org B")).toBeTruthy();
  expect(screen.getByText("2 responses")).toBeTruthy();
});

it("shows a saved note and clears the field", async () => {
  renderPage();
  const field = await noteFirst("Called them back");

  expect(await screen.findByText("Called them back")).toBeTruthy();
  expect(field).toHaveProperty("value", "");
});

it("shows a saved note once when a refetch already returned it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Org A");

  let releaseNote = () => {};
  noteGate = new Promise((resolve) => {
    releaseNote = resolve;
  });
  await noteFirst("Called them back");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await query.client.refetchQueries();
    releaseNote();
  });

  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Save note" })).toHaveLength(
      2,
    ),
  );
  expect(screen.getAllByText("Called them back")).toHaveLength(1);
});

it("keeps the note and shows the refusal when the save fails", async () => {
  writeStatus = 400;
  renderPage();
  const field = await noteFirst("Called them back");

  expect(await screen.findByText("Refused by the server")).toBeTruthy();
  expect(field).toHaveProperty("value", "Called them back");
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Save note" })).toHaveLength(
      2,
    ),
  );
});

it("asks for a note before saving an empty one", async () => {
  renderPage();
  await noteFirst("   ");

  expect(await screen.findByText("Write a note before saving")).toBeTruthy();
});

it("removes a deleted response from the list", async () => {
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("Org A"));
  expect(stored.map((r) => r.id)).toEqual([2]);
});

it("moves focus to the next response's Delete after a delete", async () => {
  renderPage();
  await deleteFirst();

  await waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Delete: Org B",
    ),
  );
});

it("moves focus to the search after deleting the last response on screen", async () => {
  stored = [partnership(1, "Org A")];
  renderPage();
  await deleteFirst();

  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByLabelText("Filter responses"),
    ),
  );
});

it("keeps the delete when a refetch started before it lands after it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Org A");

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

  expect(cachedIds(query)).toEqual([2]);
  expect(screen.queryByText("Org A")).toBeNull();
});

it("keeps the response and says so when the delete fails", async () => {
  writeStatus = 500;
  renderPage();
  await deleteFirst();

  expect(
    await screen.findByText("Couldn't delete the response from Org A."),
  ).toBeTruthy();
  expect(screen.getByText("Org A")).toBeTruthy();

  writeStatus = 200;
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /^Delete: / })).toHaveLength(
      2,
    ),
  );
  await deleteFirst();
  await waitForElementToBeRemoved(() => screen.queryByText("Org A"));
});

it("drops a response another admin already deleted", async () => {
  writeStatus = 404;
  renderPage();
  await deleteFirst();

  await waitForElementToBeRemoved(() => screen.queryByText("Org A"));
  expect(screen.queryByText("Refused by the server")).toBeNull();
});

it("says the responses failed to load instead of listing none", async () => {
  loadStatus = 500;
  renderPage();
  expect(
    await screen.findByText("Couldn't load partnership responses"),
  ).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No partnership responses yet")).toBeNull();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps the loaded responses beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByText("Org A");

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  await waitFor(() =>
    expect(
      screen.getByText(/^Couldn't refresh partnership responses\./),
    ).toBeTruthy(),
  );
  expect(screen.getByText("Org A")).toBeTruthy();
});

it("keeps the server's order and marks the responses with no note", async () => {
  stored = [
    { ...partnership(1, "Org A"), notesHistory: [note(60, 1)] },
    partnership(2, "Org B"),
  ];
  renderPage();
  await screen.findByText("Org A");

  expect(
    screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
  ).toEqual(["Org A", "Org B"]);
  expect(screen.getAllByText("To review")).toHaveLength(1);
  expect(screen.getByText(/^1 response has no note yet\. /)).toBeTruthy();
});

it("drops the To review mark once a response's first note is saved", async () => {
  renderPage();
  await noteFirst("Called them back");

  await screen.findByText("Called them back");
  expect(screen.getAllByText("To review")).toHaveLength(1);
});

it("filters the responses by organization name", async () => {
  render(
    <MemoryRouter initialEntries={["/growth/partnerships?q=org b"]}>
      <ToastProvider>
        <OutreachPartnershipsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  expect(await screen.findByText("Org B")).toBeTruthy();
  expect(screen.queryByText("Org A")).toBeNull();
  expect(screen.getByText("1 of 2 responses")).toBeTruthy();
});
