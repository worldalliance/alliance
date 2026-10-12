import type { EventLogListDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import EventLogPage from "./EventLogPage";

afterEach(cleanup);

const page = (eventType: string | null) =>
  ({
    items: [
      {
        id: `e-${eventType ?? "all"}`,
        event: "account_created",
        message: eventType ? `Only ${eventType}` : "Everything",
        blob: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        userId: null,
      },
    ],
    totalCount: 1,
    page: 1,
    limit: 50,
    totalPages: 1,
  }) satisfies EventLogListDto;

const listQueries: string[] = [];

serveApi(
  routes({
    "GET /eventlog": ({ request }) => {
      const url = new URL(request.url);
      listQueries.push(url.search);
      return Response.json(page(url.searchParams.get("eventType")));
    },
  }),
);

afterEach(() => {
  listQueries.length = 0;
});

it("lists events and reloads them for the chosen event type", async () => {
  const { wrapper: QueryProvider } = queryWrapper();
  render(
    <QueryProvider>
      <MemoryRouter>
        <EventLogPage />
      </MemoryRouter>
    </QueryProvider>,
  );

  expect(await screen.findByText("Everything")).toBeTruthy();

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "sms_inbound" },
  });

  expect(await screen.findByText("Only sms_inbound")).toBeTruthy();
  await waitFor(() =>
    expect(listQueries).toEqual([
      "?page=1&limit=50",
      "?page=1&limit=50&eventType=sms_inbound",
    ]),
  );
});
