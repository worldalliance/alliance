import type { StaffDirectoryEntryDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { ToastProvider } from "../../ui/ToastProvider";
import { StaffTab } from "./StaffTab";

const entry = (id: number, displayName: string) =>
  ({
    id,
    displayName,
    profilePicture: null,
    staffTitle: null,
    staffLink: null,
    staffDisplayOrder: id,
  }) satisfies StaffDirectoryEntryDto;

let saved: StaffDirectoryEntryDto[] = [];
let loadStatus = 200;
let saveStatus = 200;
const puts: unknown[] = [];
let putRequests = 0;
let putGate: Promise<void> | null = null;

serveApi(
  routes({
    "GET /user/staff-directory-admin": () => {
      if (loadStatus !== 200) {
        return Response.json({}, { status: loadStatus });
      }
      return Response.json(saved);
    },
    "PUT /user/staff-directory-admin": async ({ request }) => {
      putRequests += 1;
      await putGate;
      if (saveStatus !== 200) {
        return Response.json({}, { status: saveStatus });
      }
      puts.push(await request.json());
      saved = [{ ...saved[0], staffTitle: "Founder" }, saved[1]];
      return Response.json(saved);
    },
  }),
);

beforeEach(() => {
  saved = [entry(1, "Ada"), entry(2, "Grace")];
  loadStatus = 200;
  saveStatus = 200;
  puts.length = 0;
  putRequests = 0;
  putGate = null;
});

const renderPage = (query = queryWrapper()) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [{ path: "/members", element: <StaffTab /> }],
      },
    ],
    { initialEntries: ["/members?tab=staff"] },
  );
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
};

const loaded = () => screen.findAllByPlaceholderText("Brief title");
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

const editFirstTitle = async (title: string) => {
  const [firstTitle] = await screen.findAllByPlaceholderText("Brief title");
  fireEvent.change(firstTitle, { target: { value: title } });
};

it("saves an edited title and settles on the saved directory", async () => {
  renderPage();
  await loaded();

  await editFirstTitle("Founder");
  save();

  expect(await screen.findByText("Saved")).toBeTruthy();
  expect(puts).toEqual([
    {
      items: [
        { id: 1, staffTitle: "Founder", staffLink: null, staffDisplayOrder: 0 },
        { id: 2, staffTitle: null, staffLink: null, staffDisplayOrder: 1 },
      ],
    },
  ]);
  expect(screen.getAllByPlaceholderText("Brief title")[0]).toHaveProperty(
    "value",
    "Founder",
  );
});

it("keeps an edit made while a save runs", async () => {
  let releasePut = () => {};
  putGate = new Promise((resolve) => {
    releasePut = resolve;
  });
  renderPage();
  await editFirstTitle("Founder");
  save();
  await waitFor(() => expect(putRequests).toBe(1));

  const grace = screen.getAllByPlaceholderText("Brief title")[1];
  fireEvent.change(grace, { target: { value: "Engineer" } });
  // A second save can't start while the first runs.
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty(
    "disabled",
    true,
  );
  save();
  await act(async () => releasePut());
  expect(putRequests).toBe(1);
  expect(screen.getByRole("button", { name: "Save changes" })).toHaveProperty(
    "disabled",
    false,
  );

  await waitFor(() =>
    expect(screen.getAllByPlaceholderText("Brief title")[0]).toHaveProperty(
      "value",
      "Founder",
    ),
  );
  expect(screen.getAllByPlaceholderText("Brief title")[1]).toHaveProperty(
    "value",
    "Engineer",
  );
  expect(screen.queryByText("Saved")).toBeNull();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
});

it("keeps the edits when the save fails", async () => {
  saveStatus = 500;
  renderPage();
  await editFirstTitle("Founder");
  save();

  expect(
    await screen.findByText(
      "Couldn't save: The server didn't answer.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  expect(screen.getAllByPlaceholderText("Brief title")[0]).toHaveProperty(
    "value",
    "Founder",
  );
});

it("still says it is saving, then why it failed, after an edit made during the save", async () => {
  let releasePut = () => {};
  putGate = new Promise((resolve) => {
    releasePut = resolve;
  });
  saveStatus = 500;
  renderPage();
  await editFirstTitle("Founder");
  save();
  await waitFor(() => expect(putRequests).toBe(1));

  fireEvent.change(screen.getAllByPlaceholderText("Brief title")[1], {
    target: { value: "Engineer" },
  });
  expect(screen.getByText("Saving…")).toBeTruthy();
  await act(async () => releasePut());

  expect(
    await screen.findByText("Couldn't save: The server didn't answer."),
  ).toBeTruthy();
  expect(screen.getAllByPlaceholderText("Brief title")[1]).toHaveProperty(
    "value",
    "Engineer",
  );
});

it("saves a reordered directory", async () => {
  renderPage();
  await loaded();

  const [ada, grace] = screen.getAllByRole("listitem");
  const dataTransfer = { effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(ada, { dataTransfer });
  fireEvent.dragOver(grace, { dataTransfer });
  fireEvent.drop(grace, { dataTransfer });
  save();

  await screen.findByText("Saved");
  expect(puts).toEqual([
    {
      items: [
        { id: 2, staffTitle: null, staffLink: null, staffDisplayOrder: 0 },
        { id: 1, staffTitle: null, staffLink: null, staffDisplayOrder: 1 },
      ],
    },
  ]);
});

it("reorders without dragging", async () => {
  renderPage();
  await loaded();
  fireEvent.click(screen.getByRole("button", { name: "Move down: Ada" }));
  save();

  await screen.findByText("Saved");
  expect(puts).toMatchObject([
    {
      items: [
        { id: 2, staffDisplayOrder: 0 },
        { id: 1, staffDisplayOrder: 1 },
      ],
    },
  ]);
});

it("says the directory failed to load", async () => {
  loadStatus = 500;
  renderPage();
  expect(await screen.findByText("Couldn't load staff")).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});

it("keeps the loaded directory beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByRole("link", { name: "Ada" });

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(await screen.findByText(/^Couldn't refresh staff\./)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ada" })).toBeTruthy();
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it.each([
  { field: "staffTitle", placeholder: "Brief title" },
  { field: "staffLink", placeholder: "About link (optional)" },
])(
  "asks before saving a worldalliance $field, saving only on Save anyway",
  async ({ field, placeholder }) => {
    renderPage();
    const [first] = await screen.findAllByPlaceholderText(placeholder);
    const saveAs = async (value: string, choice: string) => {
      fireEvent.change(first, { target: { value } });
      save();
      fireEvent.click(await screen.findByRole("button", { name: choice }));
    };

    await saveAs("https://worldalliance.org/about", "Cancel");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await saveAs("https://worldalliance.org/team", "Save anyway");
    await waitFor(() =>
      expect(puts).toMatchObject([
        { items: [{ [field]: "https://worldalliance.org/team" }, {}] },
      ]),
    );
    expect(putRequests).toBe(1);
  },
);

it("asks before saving an absolute site link, not a site path or a title", async () => {
  renderPage();
  const [link] = await screen.findAllByPlaceholderText("About link (optional)");
  const [title] = await screen.findAllByPlaceholderText("Brief title");

  fireEvent.change(title, { target: { value: "https://thealliance.org/x" } });
  fireEvent.change(link, { target: { value: "//thealliance.org/team" } });
  save();
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("//thealliance.org/team");
  expect(dialog.textContent).not.toContain("https://thealliance.org/x");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.change(link, { target: { value: "/team" } });
  save();
  await waitFor(() => expect(putRequests).toBe(1));
  expect(screen.queryByRole("dialog")).toBeNull();
});
