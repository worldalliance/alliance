import type {
  ContractAdminDto,
  CreateContractDto,
  UpdateContractDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
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
import { answerLeaveGuard } from "../../lib/testing/leaveGuard";
import { SiteOriginLinkProvider } from "../../ui/SiteAppProvider";
import { SAVE_FAILED_FALLBACK } from "../../ui/templates/Form";
import { LOAD_FAILED_FALLBACK } from "../../ui/templates/States";
import { ToastProvider } from "../../ui/ToastProvider";
import ContractPage from "./ContractPage";

const contract = (id: number) =>
  ({
    id,
    name: "Pledge",
    createdAt: "2026-01-02T00:00:00.000Z",
    markdown: "Terms",
    startDate: null,
    endDate: null,
    description: [],
  }) satisfies ContractAdminDto;

const startDate = "2026-03-10T15:00:00.000Z";
let servedName = "Pledge";
let servedDescription: ContractAdminDto["description"] = [];
let servedStart: string | null = null;
let findStatus = 200;
let updateStatus = 200;
let listServed: ContractAdminDto[] | null = null;
let currentServed: ContractAdminDto | null = null;
let updateBody: UpdateContractDto | null = null;
let createBody: CreateContractDto | null = null;
let writes = 0;
let updateGate: Promise<void> | null = null;

serveApi(
  routes({
    "GET /contract/admin/:id": ({ params }) =>
      findStatus === 200
        ? Response.json({
            ...contract(Number(params.id)),
            name: servedName,
            description: servedDescription,
            startDate: servedStart,
          })
        : Response.json({}, { status: findStatus }),
    "GET /contract/admin": () =>
      listServed
        ? Response.json(listServed)
        : Response.json({}, { status: 500 }),
    "GET /contract/current": () =>
      currentServed
        ? Response.json(currentServed)
        : Response.json({}, { status: 500 }),
    "POST /contract/create": async ({ request }) => {
      writes += 1;
      createBody = await request.json();
      return Response.json(contract(2));
    },
    "PATCH /contract/update/:id": async ({ request, params }) => {
      writes += 1;
      if (updateStatus !== 200)
        return Response.json({}, { status: updateStatus });
      const body: UpdateContractDto = await request.json();
      updateBody = body;
      await updateGate;
      return Response.json({
        ...contract(Number(params.id)),
        name: body.name,
      });
    },
  }),
);

const hostZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
beforeEach(() => {
  process.env.TZ = "America/New_York";
});
afterEach(() => {
  process.env.TZ = hostZone;
  servedName = "Pledge";
  servedDescription = [];
  servedStart = null;
  findStatus = 200;
  updateStatus = 200;
  listServed = null;
  currentServed = null;
  updateBody = null;
  createBody = null;
  writes = 0;
  updateGate = null;
});

const renderPage = (path: string) => {
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Outlet />
          </LeaveGuard>
        ),
        children: [{ path: "/tasks/contracts/:id", element: <ContractPage /> }],
      },
    ],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.contractsAdmin(), [contract(1)]);
  render(
    <SiteOriginLinkProvider origin="https://site.test">
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SiteOriginLinkProvider>,
    query,
  );
  return { client: query.client, router };
};

const contractsInvalidated = (
  client: ReturnType<typeof renderPage>["client"],
) => client.getQueryState(queryKeys.contractsAdmin())?.isInvalidated;

const nameField = () => screen.findByLabelText<HTMLInputElement>(/^Name/);
const submitForm = () =>
  fireEvent.submit(screen.getByLabelText(/^Name/).closest("form")!);

it("refreshes the contracts list after creating a contract", async () => {
  const { client, router } = renderPage("/tasks/contracts/new");
  fireEvent.change(await nameField(), { target: { value: "Pledge" } });
  fireEvent.change(screen.getByLabelText("Text"), {
    target: { value: "Terms" },
  });
  submitForm();

  await waitFor(() => expect(contractsInvalidated(client)).toBe(true));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/tasks/contracts/2"),
  );
});

it("refreshes the contracts list after updating a contract", async () => {
  const { client } = renderPage("/tasks/contracts/1");
  await nameField();
  submitForm();

  await waitFor(() => expect(contractsInvalidated(client)).toBe(true));
});

it("refreshes the current contract after a save", async () => {
  currentServed = { ...contract(9), startDate };
  renderPage("/tasks/contracts/1");
  await nameField();
  currentServed = { ...contract(1), startDate };
  expect(
    screen.queryByText(/^Members are asked to sign this contract now/),
  ).toBeNull();
  submitForm();

  await screen.findByText(/^Members are asked to sign this contract now/);
});

it("fills the form with the loaded contract", async () => {
  renderPage("/tasks/contracts/1");

  expect(await nameField()).toHaveProperty("value", "Pledge");
});

it("keeps unsaved edits when the contract reloads", async () => {
  const { client } = renderPage("/tasks/contracts/1");
  const name = await nameField();
  fireEvent.change(name, { target: { value: "Edited" } });
  servedName = "Changed elsewhere";

  await client.refetchQueries({ queryKey: queryKeys.contractAdmin(1) });
  await screen.findByRole("heading", { name: "Changed elsewhere" });

  expect(name).toHaveProperty("value", "Edited");
});

it("keeps what is typed while a save is in flight", async () => {
  let resolve = () => {};
  updateGate = new Promise((done) => (resolve = done));
  renderPage("/tasks/contracts/1");
  const name = await nameField();
  fireEvent.change(name, { target: { value: "Charter" } });
  submitForm();
  await waitFor(() => expect(updateBody?.name).toBe("Charter"));
  fireEvent.change(name, { target: { value: "Charter 2" } });
  resolve();

  await screen.findByRole("heading", { level: 1, name: "Charter" });
  expect(name).toHaveProperty("value", "Charter 2");
});

it("titles the page with the saved name", async () => {
  renderPage("/tasks/contracts/1");
  const name = await nameField();
  fireEvent.change(name, { target: { value: "Charter" } });
  submitForm();

  expect(
    await screen.findByRole("heading", { level: 1, name: "Charter" }),
  ).toBeDefined();
});

it("reports a contract that does not exist", async () => {
  findStatus = 404;
  renderPage("/tasks/contracts/1");

  expect(await screen.findByText("Contract not found")).toBeDefined();
});

it("reports a contract the server answers with a 500 and the list lacks as not found", async () => {
  findStatus = 500;
  listServed = [contract(9)];
  renderPage("/tasks/contracts/1");

  expect(await screen.findByText("Contract not found")).toBeDefined();
  expect(screen.queryByText("Couldn't load this contract")).toBeNull();
});

it("reports a failed load", async () => {
  findStatus = 500;
  renderPage("/tasks/contracts/1");

  expect(await screen.findByText("Couldn't load this contract")).toBeDefined();
  expect(screen.getByText(LOAD_FAILED_FALLBACK)).toBeDefined();
});

it("reports a failed save and keeps the form", async () => {
  updateStatus = 500;
  renderPage("/tasks/contracts/1");
  const name = await nameField();
  submitForm();

  expect(
    await screen.findByText(`Couldn't save: ${SAVE_FAILED_FALLBACK}`),
  ).toBeDefined();
  expect(screen.getByLabelText(/^Name/)).toBe(name);
});

it("loads and saves a point's admin notes", async () => {
  servedDescription = [
    { point: "Show up", subtext: "", adminNotes: "Why it reads this way" },
  ];
  renderPage("/tasks/contracts/1");
  const notes = await screen.findByLabelText(/^Admin notes/);
  expect(notes).toHaveProperty("value", "Why it reads this way");
  fireEvent.change(notes, { target: { value: "Revised note" } });
  submitForm();

  await waitFor(() =>
    expect(updateBody).toMatchObject({
      description: [
        { point: "Show up", subtext: "", adminNotes: "Revised note" },
      ],
    }),
  );
});

it("tells signers of new points only for a change members see", async () => {
  servedDescription = [{ point: "Show up", subtext: "", adminNotes: "Why" }];
  renderPage("/tasks/contracts/1");
  fireEvent.change(await screen.findByLabelText(/^Admin notes/), {
    target: { value: "Revised note" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add point" }));
  expect(
    screen.queryByText(/signed this contract see the new points/),
  ).toBeNull();

  fireEvent.change(screen.getAllByLabelText(/^Point$/)[0], {
    target: { value: "Show up on time" },
  });
  expect(
    await screen.findByText(/signed this contract see the new points/),
  ).toBeDefined();
});

it("won't save a started contract with no points", async () => {
  servedStart = startDate;
  renderPage("/tasks/contracts/1");
  await nameField();
  submitForm();

  expect(await screen.findByText(/^Add a point/)).toBeDefined();
  expect(writes).toBe(0);
});

it("won't save a point with subtext but no point, and drops a blank one", async () => {
  renderPage("/tasks/contracts/1");
  await nameField();
  fireEvent.click(screen.getByRole("button", { name: "Add point" }));
  fireEvent.click(screen.getByRole("button", { name: "Add point" }));
  fireEvent.change(screen.getAllByLabelText(/^Subtext/)[0], {
    target: { value: "Orphan" },
  });
  submitForm();

  expect(
    await screen.findByText("Enter the point, or remove it"),
  ).toBeDefined();
  expect(writes).toBe(0);

  fireEvent.click(screen.getByRole("button", { name: "Remove point 1" }));
  submitForm();
  await waitFor(() => expect(updateBody).toMatchObject({ description: [] }));
});

it("shows the text read-only once the contract exists, and never sends it", async () => {
  renderPage("/tasks/contracts/1");
  await nameField();

  expect(screen.queryByRole("textbox", { name: "Text" })).toBeNull();
  expect(screen.getByText("Terms")).toBeDefined();
  submitForm();
  await waitFor(() => expect(updateBody).not.toBeNull());
  expect(updateBody).not.toHaveProperty("markdown");
});

it("asks for the text before creating a contract", async () => {
  renderPage("/tasks/contracts/new");
  await nameField();
  submitForm();

  expect(await screen.findByText("Enter the text members sign")).toBeDefined();
  expect(writes).toBe(0);
});

it("shows the start in Pacific time and saves it unchanged", async () => {
  servedStart = startDate;
  servedDescription = [{ point: "Show up", subtext: "", adminNotes: "" }];
  renderPage("/tasks/contracts/1");
  const start = await screen.findByLabelText<HTMLInputElement>(/^Start date/);
  await waitFor(() => expect(start.value).toBe("2026-03-10T08:00"));
  submitForm();

  await waitFor(() => expect(updateBody).toMatchObject({ startDate }));
});

it("clears a stored start date when the field is emptied", async () => {
  servedStart = startDate;
  renderPage("/tasks/contracts/1");
  const start = await screen.findByLabelText<HTMLInputElement>(/^Start date/);
  await waitFor(() => expect(start.value).not.toBe(""));
  fireEvent.change(start, { target: { value: "" } });
  submitForm();

  await waitFor(() => expect(updateBody).toMatchObject({ startDate: null }));
});

it("clears a stored start date with its Clear button", async () => {
  servedStart = startDate;
  renderPage("/tasks/contracts/1");
  fireEvent.click(
    await screen.findByRole("button", { name: "Clear start date" }),
  );
  expect(screen.queryByRole("button", { name: "Clear start date" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText(/^Start date/));
  submitForm();

  await waitFor(() => expect(updateBody).toMatchObject({ startDate: null }));
});

it("marks the in-force contract Active when the current one fails to load", async () => {
  servedStart = startDate;
  listServed = [{ ...contract(1), startDate }];
  renderPage("/tasks/contracts/1");

  await screen.findByText(/^Members are asked to sign this contract now/);
});

it("asks before leaving with unsaved changes", async () => {
  const asked = answerLeaveGuard(false);
  const { router } = renderPage("/tasks/contracts/1");
  fireEvent.change(await nameField(), { target: { value: "Edited" } });

  await act(() => router.navigate("/tasks/contracts/new"));

  expect(asked).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/tasks/contracts/1");
  asked.mockRestore();
});

it("asks before saving a name that mentions worldalliance, saving only on Save anyway", async () => {
  renderPage("/tasks/contracts/1");
  const name = await nameField();
  fireEvent.change(name, { target: { value: "See worldalliance.org" } });
  submitForm();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.change(name, { target: { value: "See worldalliance.org/b" } });
  submitForm();
  fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));
  await waitFor(() =>
    expect(updateBody).toMatchObject({ name: "See worldalliance.org/b" }),
  );
  expect(writes).toBe(1);
});

it("asks before creating a contract whose text links worldalliance, saving only on Save anyway", async () => {
  renderPage("/tasks/contracts/new");
  fireEvent.change(await nameField(), { target: { value: "Pledge" } });
  const markdown = screen.getByLabelText("Text");
  fireEvent.change(markdown, {
    target: { value: "See https://worldalliance.org/x" },
  });
  submitForm();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.change(markdown, {
    target: { value: "See https://worldalliance.org/y" },
  });
  submitForm();
  fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));
  await waitFor(() =>
    expect(createBody).toMatchObject({
      markdown: "See https://worldalliance.org/y",
    }),
  );
  expect(writes).toBe(1);
});
