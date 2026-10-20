import type { ContractAdminDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

let servedName = "Pledge";
let findStatus = 200;
let updateStatus = 200;

serveApi(
  routes({
    "GET /contract/admin/:id": ({ params }) =>
      findStatus === 200
        ? Response.json({ ...contract(Number(params.id)), name: servedName })
        : Response.json({}, { status: findStatus }),
    "POST /contract/create": () => Response.json(contract(2)),
    "PATCH /contract/update/:id": async ({ request, params }) => {
      if (updateStatus !== 200)
        return Response.json({}, { status: updateStatus });
      const { name }: { name: string } = await request.json();
      return Response.json({ ...contract(Number(params.id)), name });
    },
  }),
);

afterEach(() => {
  servedName = "Pledge";
  findStatus = 200;
  updateStatus = 200;
});

const renderPage = (path: string) => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.contractsAdmin(), [contract(1)]);
  render(
    <SiteOriginLinkProvider origin="https://site.test">
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/contracts/:id" element={<ContractPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SiteOriginLinkProvider>,
    query,
  );
  return query.client;
};

const contractsInvalidated = (client: ReturnType<typeof renderPage>) =>
  client.getQueryState(queryKeys.contractsAdmin())?.isInvalidated;

it("refreshes the contracts list after creating a contract", async () => {
  const client = renderPage("/contracts/new");
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Pledge" },
  });
  fireEvent.change(document.getElementById("markdown")!, {
    target: { value: "Terms" },
  });
  fireEvent.submit(screen.getByLabelText("Name").closest("form")!);

  await waitFor(() => expect(contractsInvalidated(client)).toBe(true));
});

it("refreshes the contracts list after updating a contract", async () => {
  const client = renderPage("/contracts/1");
  fireEvent.submit((await screen.findByLabelText("Name")).closest("form")!);

  await waitFor(() => expect(contractsInvalidated(client)).toBe(true));
});

it("fills the form with the loaded contract", async () => {
  renderPage("/contracts/1");

  expect(await screen.findByLabelText("Name")).toHaveProperty(
    "value",
    "Pledge",
  );
});

it("keeps unsaved edits when the contract reloads", async () => {
  const client = renderPage("/contracts/1");
  const name = await screen.findByLabelText("Name");
  fireEvent.change(name, { target: { value: "Edited" } });
  servedName = "Changed elsewhere";

  await client.refetchQueries({ queryKey: queryKeys.contractAdmin(1) });
  await screen.findByRole("heading", { name: "Changed elsewhere" });

  expect(name).toHaveProperty("value", "Edited");
});

it("titles the page with the saved name", async () => {
  renderPage("/contracts/1");
  const name = await screen.findByLabelText("Name");
  fireEvent.change(name, { target: { value: "Charter" } });
  fireEvent.submit(name.closest("form")!);

  expect(await screen.findByRole("heading", { name: "Charter" })).toBeDefined();
});

it("reports a contract that does not exist", async () => {
  findStatus = 404;
  renderPage("/contracts/1");

  expect(await screen.findByText("Contract not found")).toBeDefined();
});

it("reports a failed load", async () => {
  findStatus = 500;
  renderPage("/contracts/1");

  expect(await screen.findByText("Failed to load contract")).toBeDefined();
});

it("reports a failed save and keeps the form", async () => {
  updateStatus = 500;
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  renderPage("/contracts/1");
  const name = await screen.findByLabelText("Name");
  fireEvent.submit(name.closest("form")!);

  expect(await screen.findByText("Failed to save contract")).toBeDefined();
  expect(screen.getByLabelText("Name")).toBe(name);
  errors.mockRestore();
});
