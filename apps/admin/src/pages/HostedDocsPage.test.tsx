import type { HostedDocDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import HostedDocsPage from "./HostedDocsPage";

const pilot: HostedDocDto = {
  id: 1,
  slug: "2026-Pilot.pdf",
  notes: "Board packet",
  views: 7,
  createdAt: "2026-10-01T00:00:00.000Z",
  uploadedByName: "Ada Admin",
  fileReplacedAt: null,
  fileReplacedByName: null,
};
let stored: HostedDocDto[];
let writes: unknown[];

const pdf = (name: string) =>
  new File(["%PDF-1.7"], name, { type: "application/pdf" });

serveApi(
  routes({
    "GET /hosted-docs": () => Response.json(stored),
    "POST /hosted-docs": async ({ request }) => {
      const form = await request.formData();
      const file = form.get("file");
      writes.push({
        slug: form.get("slug"),
        notes: form.get("notes"),
        file: file instanceof File ? file.name : null,
      });
      const created = {
        ...pilot,
        id: 2,
        slug: String(form.get("slug")),
        views: 0,
      };
      stored = [...stored, created];
      return Response.json(created);
    },
    "POST /hosted-docs/:id/file": async ({ request, params }) => {
      const file = (await request.formData()).get("file");
      writes.push({
        replacedId: params.id,
        file: file instanceof File ? file.name : null,
      });
      return Response.json(pilot);
    },
    "PATCH /hosted-docs/:id": async ({ request }) => {
      const body = await request.json();
      writes.push(body);
      stored = [{ ...pilot, ...body }];
      return Response.json(stored[0]);
    },
    "DELETE /hosted-docs/:id": ({ params }) => {
      writes.push({ deletedId: params.id });
      stored = [];
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [pilot];
  writes = [];
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <HostedDocsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

test("lists documents with views, uploader, and replacement state", async () => {
  renderPage();
  await screen.findByText("2026-Pilot.pdf");
  expect(screen.getByText("7")).toBeTruthy();
  expect(screen.getByText("Ada Admin")).toBeTruthy();
  expect(screen.getByDisplayValue("Board packet")).toBeTruthy();
});

test("prefills the ID from the file name and uploads", async () => {
  renderPage();
  await screen.findByText("2026-Pilot.pdf");
  fireEvent.change(screen.getByLabelText("PDF"), {
    target: { files: [pdf("Annual Report 2026.pdf")] },
  });
  const id = screen.getByLabelText("ID");
  expect(id.getAttribute("value")).toBe("Annual-Report-2026.pdf");
  fireEvent.change(id, { target: { value: "AnnualReport.pdf" } });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "For the board" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByText("AnnualReport.pdf");
  expect(writes).toEqual([
    {
      slug: "AnnualReport.pdf",
      notes: "For the board",
      file: "Annual Report 2026.pdf",
    },
  ]);
  expect(screen.getByLabelText("ID").getAttribute("value")).toBe("");
});

test("rejects an invalid ID without sending it", async () => {
  renderPage();
  await screen.findByText("2026-Pilot.pdf");
  fireEvent.change(screen.getByLabelText("PDF"), {
    target: { files: [pdf("x.pdf")] },
  });
  fireEvent.change(screen.getByLabelText("ID"), {
    target: { value: "has space.pdf" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByText(/^Use up to 100 letters/);
  expect(writes).toEqual([]);
});

test("copies the URL on this environment's site", async () => {
  const priorAlt = process.env.VITE_ALT_APP_URL;
  process.env.VITE_ALT_APP_URL = "https://staging.thealliance.org";
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  renderPage();
  try {
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Copy link to 2026-Pilot.pdf",
      }),
    );
    await screen.findByText("Link copied.");
  } finally {
    process.env.VITE_ALT_APP_URL = priorAlt;
  }
  expect(writeText).toHaveBeenCalledWith(
    "https://staging.thealliance.org/docs/2026-Pilot.pdf",
  );
});

test("saves edited notes inline", async () => {
  renderPage();
  const input = await screen.findByLabelText("Notes for 2026-Pilot.pdf");
  fireEvent.change(input, { target: { value: "Final version" } });
  fireEvent.blur(input);
  await waitFor(() => expect(writes).toEqual([{ notes: "Final version" }]));
});

test("confirms before replacing a file", async () => {
  renderPage();
  fireEvent.change(
    await screen.findByLabelText("Replace file for 2026-Pilot.pdf"),
    { target: { files: [pdf("v2.pdf")] } },
  );
  expect(writes).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Replace file" }));
  await waitFor(() =>
    expect(writes).toEqual([{ replacedId: "1", file: "v2.pdf" }]),
  );
});

test("confirms before deleting a document", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete document" }),
  );
  expect(writes).toEqual([]);
  fireEvent.click(
    screen.getAllByRole("button", { name: "Delete document" }).at(-1)!,
  );
  await screen.findByText("No hosted docs yet.");
  expect(writes).toEqual([{ deletedId: "1" }]);
});
