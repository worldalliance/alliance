import type { KoraBatchDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { KoraBatches } from "./KoraBatches";

let batches: KoraBatchDto[];
let uploadResponse: () => Response;
let uploads: FormData[];

const batch = (id: string, transcriptCount: number): KoraBatchDto => ({
  id,
  transcriptCount,
  transcriptsPerAssignment: 10,
  reviewsPerTranscript: 3,
  retiredAt: null,
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
    "POST /kora/admin/batches": async ({ request }) => {
      uploads.push(await request.formData());
      return uploadResponse();
    },
  }),
);

beforeEach(() => {
  batches = [];
  uploads = [];
  uploadResponse = () => {
    batches = [batch("b-new", 12)];
    return Response.json(batches[0], { status: 201 });
  };
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

const fillAndUpload = () => {
  fireEvent.change(
    screen.getByLabelText("Transcripts file from KORA (.jsonl)"),
    {
      target: { files: [new File(['{"pair_id":"P1"}'], "pairs.jsonl")] },
    },
  );
  fireEvent.change(screen.getByLabelText("Export schema (.json)"), {
    target: { files: [new File(["{}"], "export.schema.json")] },
  });
  fireEvent.change(screen.getByLabelText("Transcripts per assignment"), {
    target: { value: "8" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
};

test("says why the list is empty and what to do", async () => {
  renderBatches();
  await screen.findByText(
    "No transcripts yet. Upload KORA's file to make the project active.",
  );
});

test("uploads both files with the settings, then offers a preview", async () => {
  renderBatches();
  await screen.findByText(/No transcripts yet/);
  fillAndUpload();

  await screen.findByText(/Read 12 transcripts\./);
  const [sent] = uploads;
  expect(sent.get("transcriptsPerAssignment")).toBe("8");
  expect(sent.get("reviewsPerTranscript")).toBe("3");
  expect(sent.get("transcripts")).toBeInstanceOf(File);
  const links = await screen.findAllByRole("link", {
    name: "Preview a random transcript",
  });
  expect(links[0].getAttribute("href")).toBe(
    "/kora-participants/preview/b-new",
  );
  await waitFor(() =>
    expect(screen.queryByText(/No transcripts yet/)).toBeNull(),
  );
});

test("asks for both files before uploading", async () => {
  renderBatches();
  await screen.findByText(/No transcripts yet/);
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  const missing = await screen.findByText(
    "Choose both the transcripts file and the export schema.",
  );
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
          { line: 5, problems: ["isn't valid JSON: Unexpected token"] },
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
  expect(alert.textContent).toContain("Line 5: isn't valid JSON");
});
