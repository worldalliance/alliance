import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionMergedResponsesTab from "./ActionMergedResponsesTab";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [{ id: "home", type: "input", kind: "text", label: "Home" }],
    },
  ],
  outputViews: [],
};

const stat = (variantId: number | null, formId: number) => ({
  variantId,
  formId,
  name: variantId == null ? "Default" : `Variant ${variantId}`,
  splitValue: null,
  assigned: 0,
  submitted: 0,
});

let withdrawalsRequested: string[] = [];
let withdrawalsHeld: Promise<void> = Promise.resolve();
let responsesHeld: Promise<void> = Promise.resolve();
let withdrawalsStatus = 200;

serveApi(
  routes({
    "GET /actions/:id/form-variants": () =>
      Response.json({ variants: [], stats: [stat(2, 5), stat(null, 4)] }),
    "GET /tasks/slug/:id": ({ params }) =>
      Response.json({
        id: Number(params.id),
        title: "Survey",
        formSnapshotId: 7,
        schema,
      }),
    "POST /tasks/responses/byForms": async () => {
      await responsesHeld;
      return Response.json([
        makeFormResponse({
          formId: 5,
          formSnapshotId: 7,
          schemaSnapshot: schema,
          answers: { home: "Paris" },
          user: makeUser({ id: 3, name: "Withdrawn Member" }),
        }),
      ]);
    },
    "GET /actions/shareLinksForForm/:formId": () => Response.json([]),
    "GET /actions/withdrawals/byForm/:formId": async ({ params }) => {
      withdrawalsRequested.push(params.formId);
      await withdrawalsHeld;
      if (withdrawalsStatus !== 200) {
        return Response.json({}, { status: withdrawalsStatus });
      }
      return Response.json([
        { userId: 3, declineReason: null, isMoral: false, outOfTime: false },
      ]);
    },
  }),
);

beforeEach(() => {
  withdrawalsRequested = [];
  withdrawalsHeld = Promise.resolve();
  responsesHeld = Promise.resolve();
  withdrawalsStatus = 200;
});

const renderTab = () =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <MemoryRouter>
        <ActionMergedResponsesTab actionId={1} />
      </MemoryRouter>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );

it("marks a variant response from a member who withdrew, loading withdrawals through the default form", async () => {
  renderTab();

  expect(await screen.findByText("Withdrew")).toBeTruthy();
  expect(withdrawalsRequested).toEqual(["4"]);
});

it("reloads withdrawals on refresh", async () => {
  renderTab();
  await screen.findByText("Withdrew");

  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() => expect(withdrawalsRequested).toEqual(["4", "4"]));
});

const hold = () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { held, release };
};

it("requests withdrawals alongside the responses and shows them only once both load", async () => {
  const withdrawals = hold();
  const responses = hold();
  withdrawalsHeld = withdrawals.held;
  responsesHeld = responses.held;
  renderTab();

  await waitFor(() => expect(withdrawalsRequested).toEqual(["4"]));
  responses.release();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText("Withdrawn Member")).toBeNull();

  withdrawals.release();
  expect(await screen.findByText("Withdrew")).toBeTruthy();
});

it("says so when withdrawals fail to load", async () => {
  withdrawalsStatus = 500;
  renderTab();

  expect(await screen.findByText("Failed to load withdrawals")).toBeTruthy();
});
