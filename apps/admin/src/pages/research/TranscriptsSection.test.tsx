import type { KoraBatchDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import { TranscriptsSection } from "./TranscriptsSection";

let batches: KoraBatchDto[];
let uploadResponse: () => Response;
let uploads: FormData[];
let closings: { id: string; body: unknown }[];

const batch = (id: string, transcriptCount: number): KoraBatchDto => ({
  id,
  transcriptCount,
  transcriptsPerAssignment: 10,
  reviewsPerTranscript: 3,
  retiredAt: null,
  closesAt: null,
  createdAt: "2026-11-10T10:00:00.000Z",
});

serveApi(
  routes({
    "GET /kora/admin/batches": () => Response.json(batches),
    "GET /kora/admin/batches/events": () => Response.json([]),
    "GET /kora/admin/project": () =>
      Response.json({
        status: "pending",
        canActivate: true,
        toNotify: 0,
        moreToNotify: 0,
      }),
    "PUT /kora/admin/batches/:id/closes-at": async ({ request, params }) => {
      closings.push({ id: params.id, body: await request.json() });
      return Response.json(batches[0]);
    },
    "POST /kora/admin/batches": async ({ request }) => {
      uploads.push(await request.formData());
      return uploadResponse();
    },
  }),
);

beforeEach(() => {
  batches = [];
  uploads = [];
  closings = [];
  uploadResponse = () => {
    batches = [batch("b-new", 12)];
    return Response.json(batches[0], { status: 201 });
  };
});

const renderBatches = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <TranscriptsSection />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

const fillAndUpload = () => {
  fireEvent.change(screen.getByLabelText("Transcripts file from KORA"), {
    target: { files: [new File(['{"pair_id":"P1"}'], "pairs.jsonl")] },
  });
  fireEvent.change(screen.getByLabelText("Transcripts per assignment"), {
    target: { value: "8" },
  });
  fireEvent.change(screen.getByLabelText(/^Closes on/), {
    target: { value: "2099-11-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
};

test("says why the list is empty and what to do", async () => {
  renderBatches();
  await screen.findByText("No transcripts yet");
  expect(
    screen.getByText(
      "Upload KORA's file below. The project can be made Active once it has transcripts.",
    ),
  ).toBeTruthy();
});

test("uploads the transcripts file with the settings, then offers a preview", async () => {
  renderBatches();
  await screen.findByText(/No transcripts yet/);
  fillAndUpload();

  await screen.findByText(/Read 12 transcripts\./);
  const [sent] = uploads;
  expect(sent.get("transcriptsPerAssignment")).toBe("8");
  expect(sent.get("reviewsPerTranscript")).toBe("5");
  expect(sent.get("transcripts")).toBeInstanceOf(File);
  expect(sent.has("exportSchema")).toBe(false);
  expect(sent.get("closesAt")).toBe(
    new Date(2099, 10, 30, 23, 59, 59, 999).toISOString(),
  );
  const links = await screen.findAllByRole("link", {
    name: "Preview a random transcript",
  });
  expect(links[0].getAttribute("href")).toBe("/research/preview/b-new");
  await waitFor(() =>
    expect(screen.queryByText(/No transcripts yet/)).toBeNull(),
  );
});

test("asks for the transcripts file before uploading", async () => {
  renderBatches();
  await screen.findByText(/No transcripts yet/);
  fireEvent.change(screen.getByLabelText(/^Closes on/), {
    target: { value: "2099-11-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  const missing = await screen.findByText("Choose the transcripts file.");
  expect(missing.getAttribute("role")).toBe("alert");
  expect(uploads).toEqual([]);
});

test("lists every rejected line by number", async () => {
  uploadResponse = () =>
    Response.json(
      {
        message: "2 lines were rejected, so nothing was uploaded.",
        rejected: [
          {
            line: 2,
            problems: ["/category must be equal to one of the allowed values"],
          },
          { line: 5, problems: ["couldn't be read: Unexpected token"] },
        ],
      },
      { status: 400 },
    );
  renderBatches();
  await screen.findByText(/No transcripts yet/);
  fillAndUpload();

  const alert = (
    await screen.findByText("2 lines were rejected, so nothing was uploaded.")
  ).closest('[role="alert"]');
  if (!alert) throw new Error("the rejection isn't announced");
  expect(alert.textContent).toContain(
    "Line 2: /category must be equal to one of the allowed values",
  );
  expect(alert.textContent).toContain("Line 5: couldn't be read");
});

test("changes a batch's closing date, as the end of that day", async () => {
  batches = [batch("b-old", 4)];
  renderBatches();
  const row = (
    await screen.findByRole("button", { name: /^Change closing date: / })
  ).closest("tr");
  if (!row) throw new Error("the change button isn't in a row");
  expect(within(row).getByText("Not set")).toBeTruthy();

  fireEvent.click(
    within(row).getByRole("button", { name: /^Change closing date: / }),
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Closes on"), {
    target: { value: "2099-12-01" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(closings).toEqual([
      {
        id: "b-old",
        body: {
          closesAt: new Date(2099, 11, 1, 23, 59, 59, 999).toISOString(),
        },
      },
    ]),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("asks for a closing day before saving one", async () => {
  batches = [batch("b-old", 4)];
  renderBatches();
  fireEvent.click(
    await screen.findByRole("button", { name: /^Change closing date: / }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
  );
  await screen.findByText("Choose the day the batch closes");
  expect(closings).toEqual([]);
});
