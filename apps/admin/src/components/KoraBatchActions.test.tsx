import { KoraBatchEventKind } from "@alliance/common/kora";
import type { KoraBatchDto, KoraBatchEventDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { KoraBatches } from "./KoraBatches";

let batches: KoraBatchDto[];
let events: KoraBatchEventDto[];
let calls: string[];
let retireStatus: number;
let eventsStatus: number;

const batch = (id: string, retiredAt: string | null = null): KoraBatchDto => ({
  id,
  transcriptCount: 4,
  transcriptsPerAssignment: 2,
  reviewsPerTranscript: 3,
  retiredAt,
  closesAt: null,
  createdAt: "2026-11-10T10:00:00.000Z",
});

const event = (
  overrides: Partial<KoraBatchEventDto> & { kind: KoraBatchEventDto["kind"] },
): KoraBatchEventDto => ({
  id: crypto.randomUUID(),
  batchId: "b1",
  batchUploadedAt: "2026-11-10T10:00:00.000Z",
  transcriptCount: null,
  ratingCount: null,
  assignmentCount: null,
  assignmentId: null,
  reviewerId: null,
  adminName: "Priya Admin",
  assignmentDeleted: false,
  createdAt: "2026-11-11T10:00:00.000Z",
  ...overrides,
});

const setRetired = (id: string, retiredAt: string | null) => {
  batches = batches.map((b) => (b.id === id ? { ...b, retiredAt } : b));
  return Response.json(batches.find((b) => b.id === id));
};

serveApi(
  routes({
    "GET /kora/admin/batches": () => Response.json(batches),
    "GET /kora/admin/batches/events": () =>
      eventsStatus === 200
        ? Response.json(events)
        : Response.json({}, { status: eventsStatus }),
    "GET /kora/admin/project": () =>
      Response.json({
        status: "active",
        canActivate: true,
        toNotify: 0,
        moreToNotify: 0,
      }),
    "POST /kora/admin/batches/:id/retire": ({ params }) => {
      if (retireStatus !== 200) {
        return Response.json(
          { message: "Batch not found" },
          { status: retireStatus },
        );
      }
      calls.push(`retire ${params.id}`);
      return setRetired(String(params.id), "2026-11-11T12:00:00.000Z");
    },
    "POST /kora/admin/batches/:id/reactivate": ({ params }) => {
      calls.push(`reactivate ${params.id}`);
      return setRetired(String(params.id), null);
    },
    "GET /kora/admin/batches/:id/deletion-impact": () =>
      Response.json({ transcriptCount: 4, ratingCount: 1, assignmentCount: 2 }),
    "DELETE /kora/admin/batches/:id": ({ params }) => {
      calls.push(`delete ${params.id}`);
      batches = batches.filter((b) => b.id !== params.id);
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  batches = [batch("b1")];
  events = [];
  calls = [];
  retireStatus = 200;
  eventsStatus = 200;
});

const renderBatches = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <KoraBatches />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

test("retires only after confirming, warning when it's the last batch being assigned", async () => {
  renderBatches();
  fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/^Retire the batch uploaded/)).toBeTruthy();
  expect(
    within(dialog).getByText(/no chat pairs will be left to assign/),
  ).toBeTruthy();
  expect(calls).toEqual([]);

  fireEvent.click(within(dialog).getByRole("button", { name: "Retire batch" }));

  await screen.findByRole("button", { name: "Reactivate" });
  expect(calls).toEqual(["retire b1"]);
  expect(screen.getByText(/^Retired /)).toBeTruthy();
});

test("leaves out the last-batch warning while another batch is still assigned", async () => {
  batches = [batch("b1"), batch("b2")];
  renderBatches();
  fireEvent.click(
    (await screen.findAllByRole("button", { name: "Retire" }))[0],
  );
  expect(
    within(screen.getByRole("dialog")).queryByText(
      /no chat pairs will be left/,
    ),
  ).toBeNull();
});

test("reports a failed retire and leaves the batch as it was", async () => {
  retireStatus = 404;
  renderBatches();
  fireEvent.click(await screen.findByRole("button", { name: "Retire" }));
  fireEvent.click(screen.getByRole("button", { name: "Retire batch" }));

  await screen.findByText("Batch not found");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Assigning")).toBeTruthy();
});

test("reactivates straight away, since it can be undone", async () => {
  batches = [batch("b1", "2026-11-11T12:00:00.000Z")];
  renderBatches();
  fireEvent.click(await screen.findByRole("button", { name: "Reactivate" }));
  await screen.findByRole("button", { name: "Retire" });
  expect(calls).toEqual(["reactivate b1"]);
  expect(screen.getByText("Assigning")).toBeTruthy();
});

test("deletes after showing how much goes with the batch", async () => {
  renderBatches();
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByText(
      /removes 4 chat pairs, 1 rating and 2 volunteer assignments/,
    ),
  ).toBeTruthy();

  fireEvent.click(within(dialog).getByRole("button", { name: "Delete batch" }));

  await waitFor(() => expect(calls).toEqual(["delete b1"]));
  await screen.findByText(/No transcripts yet/);
});

test("lists the history newest first and filters it", async () => {
  events = [
    event({
      kind: KoraBatchEventKind.AssignmentCompleted,
      assignmentId: "a-live",
      reviewerId: "rev12345-6789",
      ratingCount: 3,
      adminName: null,
    }),
    event({
      kind: KoraBatchEventKind.AssignmentCompleted,
      assignmentId: "a-gone",
      reviewerId: "rev99999-0000",
      ratingCount: 1,
      adminName: null,
      assignmentDeleted: true,
    }),
    event({
      kind: KoraBatchEventKind.Delete,
      transcriptCount: 1,
      ratingCount: 0,
      assignmentCount: 2,
    }),
    event({ kind: KoraBatchEventKind.Reactivate, adminName: null }),
    event({ kind: KoraBatchEventKind.Retire }),
    event({ kind: KoraBatchEventKind.Upload, transcriptCount: 4 }),
  ];
  renderBatches();

  const link = await screen.findByRole("link", { name: "View its export" });
  expect(link.getAttribute("href")).toBe(
    "/kora-participants/assignments/a-live",
  );
  expect(
    screen.getByText(/The assignment has since been deleted/),
  ).toBeTruthy();
  expect(
    screen.getByText(/^Priya Admin retired the batch uploaded/),
  ).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Show"), {
    target: { value: "batch" },
  });
  expect(screen.queryByRole("link", { name: "View its export" })).toBeNull();
  expect(
    screen.getByText("Priya Admin uploaded a batch of 4 chat pairs"),
  ).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Show"), {
    target: { value: "rating" },
  });
  expect(screen.queryByText(/retired the batch/)).toBeNull();
  expect(screen.getByRole("link", { name: "View its export" })).toBeTruthy();
});

test("says when the history can't load", async () => {
  eventsStatus = 500;
  renderBatches();
  await screen.findByText("Couldn't load the history. Reload to try again.");
});

test("says the history is empty", async () => {
  renderBatches();
  await screen.findByText(/^Nothing yet\. Uploads, retires/);
});
