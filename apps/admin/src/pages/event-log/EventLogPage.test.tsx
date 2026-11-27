import type {
  EventLogListDto,
  EventType,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, jest, spyOn } from "bun:test";
import { MemoryRouter, useLocation } from "react-router";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import EventLogPage from "./EventLogPage";

const page = (eventType: string | null) =>
  ({
    items: [
      {
        id: `e-${eventType ?? "all"}`,
        event: "account_created",
        message: eventType ? `Only ${eventType}` : "Everything",
        blob: eventType ? null : { phoneNumber: "+15550100" },
        createdAt: "2026-01-01T00:00:00.000Z",
        userId: 7,
        user: { id: 7, displayName: "Sam Lee" },
      },
    ],
    totalCount: eventType ? 1 : 120,
    page: 1,
    limit: 50,
    totalPages: eventType ? 1 : 3,
  }) satisfies EventLogListDto;

const listQueries: string[] = [];
let listStatus = 200;

serveApi(
  routes({
    "GET /eventlog": ({ request }) => {
      const url = new URL(request.url);
      listQueries.push(url.search);
      return Response.json(page(url.searchParams.get("eventType")), {
        status: listStatus,
      });
    },
  }),
);

afterEach(() => {
  listQueries.length = 0;
  listStatus = 200;
  jest.restoreAllMocks();
});

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const renderPage = (url = "/activity") => {
  const { wrapper: QueryProvider } = queryWrapper();
  return render(
    <QueryProvider>
      <MemoryRouter initialEntries={[url]}>
        <ToastProvider>
          <EventLogPage />
          <Search />
        </ToastProvider>
      </MemoryRouter>
    </QueryProvider>,
  );
};

it("lists events and reloads them for the chosen event type", async () => {
  renderPage();

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

it("offers every event type the server has", async () => {
  renderPage();
  const every: Record<EventType, true> = {
    account_created: true,
    contract_signed: true,
    contract_suspended: true,
    sms_unsubscribe: true,
    sms_resubscribe: true,
    sms_inbound: true,
    sms_failure: true,
    forum_action_autocomplete: true,
    action_comment: true,
    forum_reply_notif_failure: true,
    action_opt_out: true,
    account_deletion_requested: true,
    account_deleted: true,
    join_request: true,
    admin_role_changed: true,
    waitlist_mail_cap_reached: true,
    phone_number_moved: true,
  };
  const offered = within(screen.getByRole("combobox", { name: "Event type" }))
    .getAllByRole<HTMLOptionElement>("option")
    .map((option) => option.value);
  expect(offered.slice(1).sort()).toEqual(Object.keys(every).sort());
  expect(offered[0]).toBe("");
});

it("keeps the event type and the page in the URL, and the filter resets the page", async () => {
  renderPage("/activity?page=2");
  await screen.findByText("Everything");
  await waitFor(() => expect(listQueries).toContain("?page=2&limit=50"));
  expect(screen.getByTestId("search").textContent).toBe("?page=2");

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "sms_failure" },
  });
  expect(await screen.findByText("Only sms_failure")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByTestId("search").textContent).toBe("?type=sms_failure"),
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Remove filter Event type: Text failure",
    }),
  );
  expect(await screen.findByText("Everything")).toBeTruthy();
  expect(screen.getByTestId("search").textContent).toBe("");
});

it("returns to the top of the list when the event type changes", async () => {
  renderPage();
  await screen.findByText("Everything");
  const scrollTo = spyOn(Element.prototype, "scrollTo");

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "sms_failure" },
  });
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

  scrollTo.mockClear();
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Remove filter Event type: Text failure",
    }),
  );
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
});

it("links the member and opens an event's details", async () => {
  renderPage();
  expect(
    (await screen.findByRole("link", { name: "Sam Lee" })).getAttribute("href"),
  ).toBe("/members/7");
  expect(screen.getByText("120 events")).toBeTruthy();

  const details = screen.getByRole("button", { name: "Details: Everything" });
  expect(details.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(details);
  expect(details.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText(/"phoneNumber": "\+15550100"/)).toBeTruthy();
});

it("says so when events can't load, and not that there are none", async () => {
  listStatus = 500;
  renderPage();
  expect(await screen.findByText("Couldn't load events")).toBeTruthy();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeTruthy();
  expect(screen.queryByText("No events yet")).toBeNull();
});
