import { customLinkFieldsSchema } from "@alliance/common/customLinks";
import type { CustomLinkDto } from "@alliance/shared/client";
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
import { PlaceId, placeById } from "../../places";
import { ToastProvider } from "../../ui/ToastProvider";
import { chooseRowAction } from "./chooseRowAction.testing";
import { CustomLinksTab } from "./CustomLinksTab";

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
let writeGate: Promise<void>;

serveApi(
  routes({
    "GET /custom-links": () =>
      loadStatus === 200
        ? Response.json(stored)
        : Response.json({ message: "Unable to load" }, { status: loadStatus }),
    "POST /custom-links": async ({ request }) => {
      const body = await request.json();
      writes.push(body);
      await writeGate;
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
  writeGate = Promise.resolve();
  window.localStorage.clear();
});
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/growth/links?tab=custom-links"]}>
      <ToastProvider>
        <CustomLinksTab />
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
  await screen.findByText("/100k");
  expect(screen.getByText("7")).toBeTruthy();
  fill("/second-flyer");
  await screen.findByText("/second-flyer");
  expect(writes).toEqual([
    {
      label: "Second flyer",
      slug: "second-flyer",
      destination: flyer.destination,
    },
  ]);
  expect(screen.getByLabelText("Path").getAttribute("value")).toBe("");
});

test("keeps the create form read-only while the create runs", async () => {
  let release = () => {};
  writeGate = new Promise((resolve) => (release = resolve));
  renderPage();
  await screen.findByText("/100k");
  fill("/second-flyer");

  const path = screen.getByLabelText("Path");
  await waitFor(() => expect(path).toHaveProperty("readOnly", true));
  release();
  await screen.findByText("/second-flyer");
  expect(path).toHaveProperty("readOnly", false);
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

const editField = async (label: string, value: string) => {
  await chooseRowAction("/100k", "Edit…");
  const dialog = await screen.findByRole("dialog");
  const input = within(dialog).getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
  return { dialog, input };
};

test("saves an edited destination while preserving its query", async () => {
  renderPage();
  const destination = "/projects/democratic-grantmaking-26?link=new-flyer";
  await editField("Destination", destination);
  await waitFor(() => expect(stored[0].destination).toBe(destination));
  expect(writes).toEqual([{ destination }]);
});

test("keeps an unsuccessful edit visible and reports the refusal", async () => {
  writeStatus = 409;
  renderPage();
  const { dialog, input } = await editField("Destination", "/guide");
  await within(dialog).findByText("Update refused");
  expect(input.getAttribute("value")).toBe("/guide");
  expect(stored[0].destination).toBe(flyer.destination);
});

test("asks before changing a path, since the old path stops working", async () => {
  renderPage();
  await editField("Path", "/200k");
  const question = await screen.findByRole("dialog", {
    name: "Change the path of “Printed flyer”?",
  });
  expect(within(question).getByText(/\/100k stops working/)).toBeTruthy();
  expect(writes).toEqual([]);
  fireEvent.click(
    within(question).getByRole("button", { name: "Change path" }),
  );
  await waitFor(() => expect(writes).toEqual([{ slug: "200k" }]));
});

test("copies the public URL", async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy link: /100k" }),
  );
  await screen.findByText("Copied link");
  expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/100k$/));
});

test("requires confirmation before deleting a link", async () => {
  renderPage();
  await chooseRowAction("/100k", "Delete");
  expect(writes).toEqual([]);
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(writes).toEqual([]);
  await chooseRowAction("/100k", "Delete");
  fireEvent.click(await screen.findByRole("button", { name: "Delete link" }));
  await screen.findByText("No custom links yet");
  expect(writes).toEqual([{ deletedId: "1" }]);
});

test("displays a load failure and can retry", async () => {
  loadStatus = 403;
  renderPage();
  await screen.findByText("Couldn't load custom links");
  expect(screen.getByText("Unable to load")).toBeTruthy();
  loadStatus = 200;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("/100k");
});

test("places Custom links under the Links place", () => {
  const links = placeById(PlaceId.Links);
  expect(links.label).toBe("Links");
  expect(links.tabs?.map((tab) => tab.label)).toContain("Custom links");
});

test("rejects a reserved path edit without sending a request", async () => {
  renderPage();
  const { dialog } = await editField("Path", "/join");
  await within(dialog).findByText("That path is reserved by the app.");
  expect(writes).toEqual([]);
});

test("keeps the link and says so after a failed deletion", async () => {
  writeStatus = 500;
  renderPage();
  await chooseRowAction("/100k", "Delete");
  fireEvent.click(await screen.findByRole("button", { name: "Delete link" }));
  await screen.findByText("Couldn't delete /100k.");
  expect(screen.getByText("/100k")).toBeTruthy();
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
  fireEvent.click(
    await screen.findByRole("button", { name: "Copy link: /100k" }),
  );
  await screen.findByText("Couldn't copy the link.");
  expect(screen.queryByText("Copied link")).toBeNull();
});
