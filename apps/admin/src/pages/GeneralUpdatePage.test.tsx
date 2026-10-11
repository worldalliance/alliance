import type { UpdateGeneralUpdateDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { generalUpdateAdmin } from "../lib/testing/generalUpdateAdmin";
import GeneralUpdatePage from "./GeneralUpdatePage";

afterEach(cleanup);

const startDate = "2026-03-10T15:00:00.000Z";
const endDate = "2026-03-20T22:30:00.000Z";
let saved: UpdateGeneralUpdateDto | null = null;

serveApi(
  routes({
    "GET /actions/generalUpdates/admin/:id": () =>
      Response.json(
        generalUpdateAdmin(1, "Weekly note", { startDate, endDate }),
      ),
    "PATCH /actions/generalUpdates/:id": async ({ request }) => {
      saved = await request.json();
      return Response.json(
        generalUpdateAdmin(1, "Weekly note", { startDate, endDate }),
      );
    },
    "GET /actions/suites": () => Response.json([]),
    "GET /user/members": () => Response.json([]),
    "GET /user/tags": () => Response.json([]),
  }),
);

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeEach(() => {
  saved = null;
  process.env.TZ = "America/New_York";
});
afterEach(() => {
  process.env.TZ = hostZone;
});

const renderPage = () => {
  const router = createMemoryRouter(
    [{ path: "/general-updates/:id", element: <GeneralUpdatePage /> }],
    { initialEntries: ["/general-updates/1"] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

it("shows the stored schedule in the admin's local time", async () => {
  renderPage();
  const start = await screen.findByLabelText<HTMLInputElement>("Start Date");
  await waitFor(() => expect(start.value).toBe("2026-03-10T11:00"));
  expect(screen.getByLabelText<HTMLInputElement>("End Date").value).toBe(
    "2026-03-20T18:30",
  );
});

it("saves an untouched schedule unchanged", async () => {
  renderPage();
  const start = await screen.findByLabelText<HTMLInputElement>("Start Date");
  await waitFor(() => expect(start.value).not.toBe(""));

  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

  await waitFor(() => expect(saved).not.toBeNull());
  expect(saved).toMatchObject({ startDate, endDate });
});
