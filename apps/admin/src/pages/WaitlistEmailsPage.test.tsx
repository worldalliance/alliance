import type {
  WaitlistEmailBatchDetailDto,
  WaitlistEmailBatchDto,
} from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { emailDraftFromState, SENDING_POLL_MS } from "../lib/waitlistEmail";
import WaitlistEmailsPage from "./WaitlistEmailsPage";

const batch: WaitlistEmailBatchDto = {
  id: 4,
  subject: "You're invited",
  body: "Join: #{signupLink}",
  mobilize: true,
  includeClaimed: false,
  staffName: "Staff Person",
  createdAt: "2026-09-02T00:00:00.000Z",
  counts: {
    pending: 0,
    sending: 0,
    sent: 1,
    failed: 1,
    uncertain: 1,
    skipped: 1,
  },
};

const detail: WaitlistEmailBatchDetailDto = {
  ...batch,
  recipients: [
    {
      id: 1,
      entryId: 11,
      name: "Sent Person",
      email: "sent@example.com",
      phoneNumber: null,
      status: "sent",
      skipReason: null,
      error: null,
      acceptedAt: "2026-09-02T00:01:00.000Z",
    },
    {
      id: 2,
      entryId: 12,
      name: "Failed Person",
      email: "failed@example.com",
      phoneNumber: null,
      status: "failed",
      skipReason: null,
      error: "550 mailbox unavailable",
      acceptedAt: null,
    },
    {
      id: 3,
      entryId: 13,
      name: "Skipped Person",
      email: "skipped@example.com",
      phoneNumber: null,
      status: "skipped",
      skipReason: "unsubscribed",
      error: null,
      acceptedAt: null,
    },
    {
      id: 4,
      entryId: 14,
      name: "Phone Person",
      email: null,
      phoneNumber: "+14155552671",
      status: "skipped",
      skipReason: "no_email",
      error: null,
      acceptedAt: null,
    },
  ],
};

let retries: unknown[];
let retryRefused: boolean;
let listed: WaitlistEmailBatchDto[];
let detailServed: WaitlistEmailBatchDetailDto;

serveApi(
  routes({
    "GET /waitlist/admin/emails": () => Response.json(listed),
    "GET /waitlist/admin/emails/:id": () => Response.json(detailServed),
    "POST /waitlist/admin/emails/:id/retry": async ({ request }) => {
      if (retryRefused) {
        return Response.json(
          { message: "Waitlist email not found" },
          { status: 404 },
        );
      }
      retries.push(await request.json());
      listed = [
        { ...batch, counts: { ...batch.counts, failed: 0, pending: 1 } },
      ];
      detailServed = {
        ...detail,
        recipients: detail.recipients.map((recipient) =>
          recipient.status === "failed"
            ? { ...recipient, status: "pending", error: null }
            : recipient,
        ),
      };
      return Response.json(batch);
    },
  }),
);

beforeEach(() => {
  retries = [];
  retryRefused = false;
  listed = [batch];
  detailServed = detail;
});

afterEach(cleanup);

const DraftProbe = () => {
  const draft = emailDraftFromState(useLocation().state);
  return (
    <p>
      Composing {draft?.subject}: {draft?.body}
    </p>
  );
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/waitlist-emails"]}>
      <ToastProvider>
        <Routes>
          <Route path="/waitlist-emails" element={<WaitlistEmailsPage />} />
          <Route path="/waitlist" element={<DraftProbe />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const openBatch = async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: /You're invited/ }),
  );
  await screen.findByText("Failed Person");
};

it("lists emails with their counts and shows a batch's recipients", async () => {
  renderPage();
  expect(
    await screen.findByText("Sent 1 · Failed 1 · Uncertain 1 · Skipped 1"),
  ).toBeTruthy();
  expect(screen.getByText(/Staff Person · Marks mobilized/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /You're invited/ }));
  expect(await screen.findByText("550 mailbox unavailable")).toBeTruthy();
  expect(screen.getByText("Unsubscribed")).toBeTruthy();
  expect(screen.getByText("(415) 555-2671")).toBeTruthy();
  expect(
    screen.getByText(
      `Sent ${formatDateTime(new Date("2026-09-02T00:01:00.000Z"))}`,
    ),
  ).toBeTruthy();
});

it("retries failed recipients after confirming", async () => {
  await openBatch();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry 1 failed recipient" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(/don't get it again/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(retries).toEqual([{ includeUncertain: false }]));
  expect(await screen.findByText(/Pending 1/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Retry 1 failed recipient" }),
  ).toBeNull();
  expect(await screen.findByText("Resending the email")).toBeTruthy();
  await waitFor(() =>
    expect(
      screen.getByText("Failed Person").closest("tr")?.textContent,
    ).toContain("Pending"),
  );
});

it("retries nothing when the confirmation is cancelled", async () => {
  await openBatch();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry 1 failed recipient" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(retries).toEqual([]);
  expect(
    screen.getByRole("button", { name: "Retry 1 failed recipient" }),
  ).toBeTruthy();
});

it("warns that uncertain recipients could get the email twice", async () => {
  await openBatch();
  fireEvent.click(
    screen.getByRole("button", { name: "Resend failed and uncertain" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(/could get it twice/),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(retries).toEqual([{ includeUncertain: true }]));
});

it("uses an email again as a new draft on the waitlist", async () => {
  await openBatch();
  fireEvent.click(
    screen.getByRole("button", { name: "Use again as a new draft" }),
  );
  expect(
    await screen.findByText("Composing You're invited: Join: #{signupLink}"),
  ).toBeTruthy();
});

describe("while an email is still sending", () => {
  const realSetInterval = globalThis.setInterval;

  beforeEach(() => {
    // Shortens the sending poll so the tests don't wait it out. Not
    // `jest.useFakeTimers`, which in bun breaks `waitFor` for later test files.
    // The cast only bridges the DOM and bun overloads of setInterval; the
    // wrapper forwards to the real one.
    globalThis.setInterval = ((handler: TimerHandler, delay?: number) =>
      realSetInterval(
        handler,
        delay === SENDING_POLL_MS ? 10 : delay,
      )) as typeof setInterval;
  });

  afterEach(() => {
    globalThis.setInterval = realSetInterval;
  });

  it("refreshes the list", async () => {
    listed = [{ ...batch, counts: { ...batch.counts, sent: 0, sending: 1 } }];
    renderPage();
    await screen.findByText("Sending 1 · Failed 1 · Uncertain 1 · Skipped 1");
    listed = [batch];
    expect(
      await screen.findByText("Sent 1 · Failed 1 · Uncertain 1 · Skipped 1"),
    ).toBeTruthy();
  });

  it("refreshes an open email's recipients", async () => {
    const [sent, ...rest] = detail.recipients;
    detailServed = {
      ...detail,
      counts: { ...detail.counts, sent: 0, sending: 1 },
      recipients: [{ ...sent, status: "sending", acceptedAt: null }, ...rest],
    };
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /You're invited/ }),
    );
    await screen.findByText("Sending");
    detailServed = detail;
    expect(
      await screen.findByText(
        `Sent ${formatDateTime(new Date("2026-09-02T00:01:00.000Z"))}`,
      ),
    ).toBeTruthy();
  });
});

it("offers to resend only uncertain recipients when none failed", async () => {
  listed = [{ ...batch, counts: { ...batch.counts, failed: 0 } }];
  await openBatch();
  fireEvent.click(
    await screen.findByRole("button", { name: "Resend uncertain" }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText(
      /^Resends to 1 uncertain recipient\./,
    ),
  ).toBeTruthy();
});

it("says when a retry is refused and keeps offering it", async () => {
  retryRefused = true;
  await openBatch();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry 1 failed recipient" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("Waitlist email not found")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Retry 1 failed recipient" }),
  ).toBeTruthy();
});
