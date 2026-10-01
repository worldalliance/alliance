import type { ContractAdminDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import ContractPage from "./ContractPage";

afterEach(cleanup);

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

serveApi(
  routes({
    "GET /contract/admin/:id": ({ params }) =>
      Response.json(contract(Number(params.id))),
    "POST /contract/create": () => Response.json(contract(2)),
    "PATCH /contract/update/:id": ({ params }) =>
      Response.json(contract(Number(params.id))),
  }),
);

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
