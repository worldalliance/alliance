import type { KoraAdminOverviewDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import KoraParticipantsPage from "./KoraParticipantsPage";

let overview: KoraAdminOverviewDto;
let loadStatus = 200;
let deleteStatus = 204;
const deleted: string[] = [];

serveApi(
  routes({
    "GET /kora/admin/batches": () => Response.json([]),
    "GET /kora/admin/batches/events": () => Response.json([]),
    "GET /kora/admin/results/answers": () =>
      Response.json({
        profiles: 0,
        profile: [],
        exitSurveys: 0,
        exitSurvey: [],
      }),
    "GET /kora/admin/project": () =>
      Response.json({
        status: "pending",
        canActivate: false,
        toNotify: 0,
        moreToNotify: 0,
      }),
    "GET /kora/admin/participants": () =>
      loadStatus === 200
        ? Response.json(overview)
        : Response.json({}, { status: loadStatus }),
    "DELETE /kora/admin/abandoned-signups/:id": ({ params }) => {
      deleted.push(`abandoned:${params.id}`);
      overview = {
        ...overview,
        abandonedSignups: overview.abandonedSignups.filter(
          (s) => s.id !== params.id,
        ),
      };
      return new Response(null, { status: 204 });
    },
    "DELETE /kora/admin/participants/:id": ({ params }) => {
      if (deleteStatus !== 204) {
        return Response.json({}, { status: deleteStatus });
      }
      deleted.push(`participant:${params.id}`);
      overview = {
        ...overview,
        participants: overview.participants.filter((p) => p.id !== params.id),
      };
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  loadStatus = 200;
  deleteStatus = 204;
  deleted.length = 0;
  overview = {
    participants: [
      {
        id: "p-ada",
        name: "Ada",
        email: "ada@example.com",
        phoneNumber: null,
        timeZone: "Europe/Oslo",
        createdAt: "2026-11-02T10:00:00.000Z",
        providers: ["google"],
      },
      {
        id: "p-grace",
        name: "Grace",
        email: null,
        phoneNumber: "+15555550100",
        timeZone: null,
        createdAt: "2026-11-03T10:00:00.000Z",
        providers: [],
      },
    ],
    abandonedSignups: [
      {
        id: "a1",
        channel: "email",
        destination: "left@example.com",
        provider: null,
        verifiedAt: "2026-11-03T11:00:00.000Z",
        recovered: false,
      },
    ],
  };
});

const renderPage = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <KoraParticipantsPage />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

const participantRows = async () => {
  const table = (await screen.findAllByRole("table"))[0];
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
};

it("shows totals, newest participants first, and filters by search", async () => {
  renderPage();
  expect(await participantRows()).toEqual(["Grace", "Ada"]);
  expect(screen.getByText("Email code, Google")).toBeTruthy();
  expect(screen.getByText("left@example.com")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Search by name, email or phone"), {
    target: { value: "555 0100" },
  });
  expect(await participantRows()).toEqual(["Grace"]);
  expect(
    screen.getByText("No abandoned signups match your search."),
  ).toBeTruthy();
});

it("sorts by name when its header is clicked", async () => {
  renderPage();
  await participantRows();
  fireEvent.click(screen.getByRole("button", { name: "Name" }));
  expect(await participantRows()).toEqual(["Ada", "Grace"]);
  fireEvent.click(screen.getByRole("button", { name: "Name" }));
  expect(await participantRows()).toEqual(["Grace", "Ada"]);
});

it("deletes a participant only after confirming", async () => {
  renderPage();
  await participantRows();
  const adaRow = screen.getByText("ada@example.com").closest("tr")!;
  fireEvent.click(within(adaRow).getByRole("button", { name: "Delete" }));
  expect(await screen.findByText("Delete Ada?")).toBeTruthy();
  expect(deleted).toEqual([]);

  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  expect(await screen.findByText("Deleted Ada")).toBeTruthy();
  expect(deleted).toEqual(["participant:p-ada"]);
  expect(await participantRows()).toEqual(["Grace"]);
});

it("deletes an abandoned signup after confirming", async () => {
  renderPage();
  const row = (await screen.findByText("left@example.com")).closest("tr")!;
  fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(
      "Delete the abandoned signup for left@example.com?",
    ),
  ).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  expect(
    await screen.findByText(
      "Deleted the abandoned signup for left@example.com",
    ),
  ).toBeTruthy();
  expect(deleted).toEqual(["abandoned:a1"]);
  expect(await screen.findByText("No abandoned signups.")).toBeTruthy();
});

it("treats a participant another admin already deleted as deleted", async () => {
  renderPage();
  await participantRows();
  deleteStatus = 404;
  overview = {
    ...overview,
    participants: overview.participants.filter((p) => p.id !== "p-ada"),
  };
  const adaRow = screen.getByText("ada@example.com").closest("tr")!;
  fireEvent.click(within(adaRow).getByRole("button", { name: "Delete" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete",
    }),
  );
  expect(await screen.findByText("Deleted Ada")).toBeTruthy();
  expect(await participantRows()).toEqual(["Grace"]);
});

it("reports a failed delete, closes the dialog and refreshes the list", async () => {
  renderPage();
  await participantRows();
  deleteStatus = 500;
  const adaRow = screen.getByText("ada@example.com").closest("tr")!;
  fireEvent.click(within(adaRow).getByRole("button", { name: "Delete" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete",
    }),
  );
  expect(await screen.findByText("Couldn't delete. Try again.")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(await participantRows()).toEqual(["Grace", "Ada"]);
});

it("says when no one has signed up, rather than showing an empty table", async () => {
  overview = { participants: [], abandonedSignups: [] };
  renderPage();
  expect(await screen.findByText("No one has signed up yet.")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "export csv" }).hasAttribute("disabled"),
  ).toBe(true);
});

it("shows a load failure instead of an empty list", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("No one has signed up yet.")).toBeNull();
});
