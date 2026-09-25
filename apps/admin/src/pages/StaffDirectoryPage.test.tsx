import type { StaffDirectoryEntryDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import StaffDirectoryPage from "./StaffDirectoryPage";

afterEach(cleanup);

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
let loadGate = Promise.resolve();
let saveStatus = 200;
const puts: unknown[] = [];

serveApi(
  routes({
    "GET /user/staff-directory-admin": () => {
      if (loadStatus !== 200) {
        return Response.json({}, { status: loadStatus });
      }
      const snapshot = saved;
      return loadGate.then(() => Response.json(snapshot));
    },
    "PUT /user/staff-directory-admin": async ({ request }) => {
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
  loadGate = Promise.resolve();
  saveStatus = 200;
  puts.length = 0;
});

const renderPage = (query = queryWrapper()) =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <StaffDirectoryPage />
      </MemoryRouter>
    </ToastProvider>,
    query,
  );

const editFirstTitle = async (title: string) => {
  const [firstTitle] = await screen.findAllByPlaceholderText("Brief title");
  fireEvent.change(firstTitle, { target: { value: title } });
};

it("saves an edited title and settles on the saved directory", async () => {
  renderPage();
  expect(
    await screen.findByRole("button", { name: "No changes to save" }),
  ).toBeTruthy();

  await editFirstTitle("Founder");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(
    await screen.findByRole("button", { name: "No changes to save" }),
  ).toBeTruthy();
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

it("keeps the edits when the save fails", async () => {
  saveStatus = 500;
  renderPage();
  await editFirstTitle("Founder");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(
    await screen.findByText("Failed to save staff directory"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  expect(screen.getAllByPlaceholderText("Brief title")[0]).toHaveProperty(
    "value",
    "Founder",
  );
});

it("saves a reordered directory", async () => {
  renderPage();
  await screen.findByRole("button", { name: "No changes to save" });

  const [ada, grace] = screen.getAllByRole("listitem");
  const dataTransfer = { effectAllowed: "", dropEffect: "" };
  fireEvent.dragStart(ada, { dataTransfer });
  fireEvent.dragOver(grace, { dataTransfer });
  fireEvent.drop(grace, { dataTransfer });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await screen.findByRole("button", { name: "No changes to save" });
  expect(puts).toEqual([
    {
      items: [
        { id: 2, staffTitle: null, staffLink: null, staffDisplayOrder: 0 },
        { id: 1, staffTitle: null, staffLink: null, staffDisplayOrder: 1 },
      ],
    },
  ]);
});

it("says the directory failed to load", async () => {
  loadStatus = 500;
  renderPage();
  expect(
    await screen.findByText("Failed to load staff directory"),
  ).toBeTruthy();
  expect(screen.queryByRole("list")).toBeNull();
});

it("keeps the loaded directory beside a refetch error", async () => {
  const query = queryWrapper();
  renderPage(query);
  await screen.findByRole("link", { name: "Ada" });

  loadStatus = 500;
  await act(() => query.client.refetchQueries());

  expect(
    await screen.findByText("Failed to load staff directory"),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ada" })).toBeTruthy();
});

it("keeps the save when a refetch started before it lands after it", async () => {
  const query = queryWrapper();
  renderPage(query);
  await editFirstTitle("Founder");

  let releaseLoad = () => {};
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  const refetch = query.client.refetchQueries();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "No changes to save" });

  await act(async () => {
    releaseLoad();
    await refetch;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(
    query.client.getQueryData<StaffDirectoryEntryDto[]>(
      queryKeys.staffDirectoryAdmin(),
    )?.[0].staffTitle,
  ).toBe("Founder");

  expect(screen.getAllByPlaceholderText("Brief title")[0]).toHaveProperty(
    "value",
    "Founder",
  );
});

it("says the session expired when the load is refused with a 401", async () => {
  loadStatus = 401;
  renderPage();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});
