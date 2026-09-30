import type {
  WaitlistEmailBatchDetailDto,
  WaitlistEmailBatchDto,
} from "@alliance/shared/client/types.gen";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SENDING_POLL_MS } from "../lib/waitlistEmail";
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
      status: "skipped",
      skipReason: "unsubscribed",
      error: null,
      acceptedAt: null,
    },
  ],
};

let listed: WaitlistEmailBatchDto[];
let detailServed: WaitlistEmailBatchDetailDto;

serveApi(
  routes({
    "GET /waitlist/admin/emails": () => Response.json(listed),
    "GET /waitlist/admin/emails/:id": () => Response.json(detailServed),
  }),
);

beforeEach(() => {
  listed = [batch];
  detailServed = detail;
});

afterEach(cleanup);

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/waitlist-emails"]}>
      <ToastProvider>
        <WaitlistEmailsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("lists emails with their counts and shows a batch's recipients", async () => {
  renderPage();
  expect(
    await screen.findByText("Sent 1 · Failed 1 · Uncertain 1 · Skipped 1"),
  ).toBeTruthy();
  expect(screen.getByText(/Staff Person · Marks mobilized/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /You're invited/ }));
  expect(await screen.findByText("550 mailbox unavailable")).toBeTruthy();
  expect(screen.getByText("Unsubscribed")).toBeTruthy();
  expect(
    screen.getByText(
      `Sent ${formatDateTime(new Date("2026-09-02T00:01:00.000Z"))}`,
    ),
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
