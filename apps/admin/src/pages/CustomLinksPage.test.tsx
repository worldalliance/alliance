import { customLinkFieldsSchema } from "@alliance/common/customLinks";
import type { CustomLinkDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import SidebarNav from "../components/SidebarNav";
import CustomLinksPage from "./CustomLinksPage";

const flyer: CustomLinkDto = {
  id: 1,
  label: "Printed flyer",
  slug: "100k",
  destination: "/projects/democratic-grantmaking-26?link=flyer",
  visits: 7,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};
let stored: CustomLinkDto[];
let writeStatus: number;
let loadStatus: number;
let writes: unknown[];

serveApi(
  routes({
    "GET /custom-links": () =>
      loadStatus === 200
        ? Response.json(stored)
        : Response.json({ message: "Unable to load" }, { status: loadStatus }),
    "POST /custom-links": async ({ request }) => {
      const body = await request.json();
      writes.push(body);
      if (writeStatus !== 200)
        return Response.json(
          { message: "That custom path already exists." },
          { status: writeStatus },
        );
      const created = {
        ...flyer,
        ...customLinkFieldsSchema.parse(body),
        id: 2,
        visits: 0,
      };
      stored = [...stored, created];
      return Response.json(created);
    },
    "PATCH /custom-links/:id": async ({ request, params }) => {
      const body = await request.json();
      writes.push(body);
      if (writeStatus !== 200)
        return Response.json(
          { message: "Update refused" },
          { status: writeStatus },
        );
      const updated = {
        ...flyer,
        ...customLinkFieldsSchema.partial().parse(body),
        id: Number(params.id),
      };
      stored = stored.map((link) => (link.id === updated.id ? updated : link));
      return Response.json(updated);
    },
    "DELETE /custom-links/:id": ({ params }) => {
      writes.push({ deletedId: params.id });
      if (writeStatus !== 200)
        return Response.json(
          { message: "Delete refused" },
          { status: writeStatus },
        );
      stored = stored.filter((link) => link.id !== Number(params.id));
      return new Response(null, { status: 200 });
    },
  }),
);

beforeEach(() => {
  stored = [flyer];
  writeStatus = 200;
  loadStatus = 200;
  writes = [];
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <CustomLinksPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
const fill = (slug: string) => {
  fireEvent.change(screen.getByLabelText("Label"), {
    target: { value: "Second flyer" },
  });
  fireEvent.change(screen.getByLabelText("Path"), { target: { value: slug } });
  fireEvent.change(screen.getByLabelText("Destination"), {
    target: { value: flyer.destination },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create link" }));
};

test("shows visit counts and creates a custom link with the full waitlist destination", async () => {
  renderPage();
  await screen.findByDisplayValue("/100k");
  expect(screen.getByText("7")).toBeTruthy();
  fill("/second-flyer");
  await screen.findByDisplayValue("/second-flyer");
  expect(writes).toEqual([
    {
      label: "Second flyer",
      slug: "second-flyer",
      destination: flyer.destination,
    },
  ]);
  expect(screen.getByLabelText("Path").getAttribute("value")).toBe("");
});

test("rejects reserved paths without sending them to the API", async () => {
  renderPage();
  fill("/join");
  expect(
    await screen.findByText("That path is reserved by the app."),
  ).toBeTruthy();
  expect(writes).toEqual([]);
});

test("keeps the create form and displays a duplicate-path refusal", async () => {
  writeStatus = 409;
  renderPage();
  fill("/100k");
  await screen.findByText("That custom path already exists.");
  expect(screen.getByLabelText("Path").getAttribute("value")).toBe("/100k");
});

test("saves an edited destination inline while preserving its query", async () => {
  renderPage();
  const input = await screen.findByLabelText("Destination for /100k");
  const destination = "/projects/democratic-grantmaking-26?link=new-flyer";
  fireEvent.change(input, { target: { value: destination } });
  fireEvent.blur(input);
  await waitFor(() => expect(stored[0].destination).toBe(destination));
  expect(writes).toEqual([{ destination }]);
});

test("keeps an unsuccessful edit visible and reports the refusal", async () => {
  writeStatus = 409;
  renderPage();
  const input = await screen.findByLabelText("Destination for /100k");
  fireEvent.change(input, { target: { value: "/guide" } });
  fireEvent.blur(input);
  await screen.findByText("Update refused");
  expect(input.getAttribute("value")).toBe("/guide");
  expect(stored[0].destination).toBe(flyer.destination);
});

test("copies the public URL", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Copy /100k" }));
  await screen.findByText("Link copied.");
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/100k$/));
});

test("requires confirmation before deleting a link", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Delete link" }));
  expect(writes).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(writes).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Delete link" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByText("No custom links yet.");
  expect(writes).toEqual([{ deletedId: "1" }]);
});

test("displays a load failure and can retry", async () => {
  loadStatus = 403;
  renderPage();
  await screen.findByText("Unable to load");
  loadStatus = 200;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByDisplayValue("/100k");
});

test("places Custom Links under the renamed Links folder", () => {
  render(
    <MemoryRouter initialEntries={["/custom-links"]}>
      <SidebarNav
        groupAssignmentCount={0}
        pendingOutreachPartnershipCount={0}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole("button", { name: "Links" })).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: "Custom Links" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.queryByText("Invites & Sharing")).toBeNull();
});

test("rejects a reserved inline path edit without sending a request", async () => {
  renderPage();
  const input = await screen.findByLabelText("Path for /100k");
  fireEvent.change(input, { target: { value: "/join" } });
  fireEvent.blur(input);
  await screen.findByText("That path is reserved by the app.");
  expect(writes).toEqual([]);
});

test("keeps the link and confirmation open after a failed deletion", async () => {
  writeStatus = 500;
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Delete link" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByText("Could not delete the custom link.");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(stored).toEqual([flyer]);
});

test("reports a failed clipboard write", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: jest.fn().mockRejectedValue(new Error("Clipboard denied")),
    },
  });
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Copy /100k" }));
  await screen.findByText("Could not copy the link.");
  expect(screen.queryByText("Link copied.")).toBeNull();
});
