import type { FormSchema } from "@alliance/common/forms/form-schema";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeFormResponse,
  makeProfile,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
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
  submitted,
});

let withdrawalsRequested: string[] = [];
let withdrawalsHeld: Promise<void> = Promise.resolve();
let responsesHeld: Promise<void> = Promise.resolve();
let withdrawalsStatus = 200;
let variantsStatus = 200;
let variantsRequests = 0;
let variantsHeld: Promise<void> = Promise.resolve();
let submitted = 0;
let responsesRequests = 0;
let respondentNames = ["Withdrawn Member"];
let anonymousSid: string | null = null;
let failingRoute: string | null = null;
let refusal = () => Response.json({}, { status: 500 });

const refusedOr = (route: string, ok: () => Response | Promise<Response>) =>
  failingRoute === route ? refusal() : ok();

serveApi(
  routes({
    "GET /actions/:id/form-variants": async () => {
      variantsRequests++;
      await variantsHeld;
      return variantsStatus === 200
        ? Response.json({ variants: [], stats: [stat(2, 5), stat(null, 4)] })
        : Response.json({}, { status: variantsStatus });
    },
    "GET /tasks/slug/:id": ({ params }) =>
      refusedOr("GET /tasks/slug/:id", () =>
        Response.json({
          id: Number(params.id),
          title: "Survey",
          formSnapshotId: 7,
          schema,
        }),
      ),
    "POST /tasks/responses/byForms": async () => {
      responsesRequests++;
      const name = respondentNames[responsesRequests - 1] ?? "Withdrawn Member";
      await responsesHeld;
      return refusedOr("POST /tasks/responses/byForms", () =>
        Response.json([
          makeFormResponse({
            formId: 5,
            formSnapshotId: 7,
            schemaSnapshot: schema,
            answers: { home: "Paris" },
            ...(anonymousSid == null
              ? { user: makeUser({ id: 3, name }) }
              : { sid: anonymousSid }),
          }),
        ]),
      );
    },
    "GET /actions/shareLinksForForm/:formId": () =>
      refusedOr("GET /actions/shareLinksForForm/:formId", () =>
        Response.json([{ sid: "invite-1", user: makeProfile(9) }]),
      ),
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
  variantsStatus = 200;
  variantsRequests = 0;
  variantsHeld = Promise.resolve();
  submitted = 0;
  responsesRequests = 0;
  respondentNames = ["Withdrawn Member"];
  anonymousSid = null;
  failingRoute = null;
  refusal = () => Response.json({}, { status: 500 });
});

const tab = (actionId: number) => (
  <SiteOriginLinkProvider origin="https://worldalliance.org">
    <ToastProvider>
      <MemoryRouter>
        <ActionMergedResponsesTab actionId={actionId} />
      </MemoryRouter>
    </ToastProvider>
  </SiteOriginLinkProvider>
);

const renderTab = (query = queryWrapper()) => render(tab(1), query);

it("marks a variant response from a member who withdrew, loading withdrawals through the default form", async () => {
  renderTab();

  expect(await screen.findByText("Withdrew")).toBeTruthy();
  expect(withdrawalsRequested).toEqual(["4"]);
});

it("reloads the variants and withdrawals on refresh", async () => {
  renderTab();
  await screen.findByText("Withdrew");

  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

  await waitFor(() => expect(withdrawalsRequested).toEqual(["4", "4"]));
  expect(variantsRequests).toBe(2);
});

it("says so when the variants fail to load", async () => {
  variantsStatus = 500;
  renderTab();

  expect(await screen.findByText("Failed to load form responses")).toBeTruthy();
});

it.each(["GET /tasks/slug/:id", "POST /tasks/responses/byForms"])(
  "says so when %s fails",
  async (route) => {
    failingRoute = route;
    renderTab();

    expect(
      await screen.findByText("Failed to load form responses"),
    ).toBeTruthy();
  },
);

const SHARE_LINKS_FAILED =
  "Failed to load share links, so invited respondents show as anonymous";

it("names who invited an anonymous respondent", async () => {
  anonymousSid = "invite-1";
  renderTab();

  expect(
    (await screen.findAllByText("anonymous invited by User 9")).length,
  ).toBeGreaterThan(0);
});

it("keeps the responses up when only the share links fail to load, until a refresh loads them", async () => {
  failingRoute = "GET /actions/shareLinksForForm/:formId";
  renderTab();

  expect(await screen.findByText(SHARE_LINKS_FAILED)).toBeTruthy();
  expect(screen.getByText("Withdrew")).toBeTruthy();
  expect(screen.queryByText("Failed to load form responses")).toBeNull();

  failingRoute = null;
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() =>
    expect(screen.queryByText(SHARE_LINKS_FAILED)).toBeNull(),
  );
  expect(screen.getByText("Withdrew")).toBeTruthy();
});

it("shows the server's message when it refuses the responses", async () => {
  failingRoute = "POST /tasks/responses/byForms";
  refusal = () =>
    Response.json(
      { message: "Only owners can view this form" },
      { status: 403 },
    );
  renderTab();

  expect(
    await screen.findByText("Only owners can view this form"),
  ).toBeTruthy();
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

it("keeps the responses when a refetch changes only the variants' counts", async () => {
  const query = queryWrapper();
  renderTab(query);
  await screen.findByText("Withdrew");

  submitted = 1;
  await query.client.refetchQueries({
    queryKey: queryKeys.formVariantsAdmin(1),
  });
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(variantsRequests).toBe(2);
  expect(responsesRequests).toBe(1);
});

it("keeps a reload's responses over those of the reload it replaced", async () => {
  respondentNames = ["Initial Member", "First Member", "Second Member"];
  renderTab();
  await screen.findByText("Initial Member");

  const first = hold();
  responsesHeld = first.held;
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(responsesRequests).toBe(2));

  responsesHeld = Promise.resolve();
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  expect(await screen.findByText("Second Member")).toBeTruthy();
  first.release();
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(screen.queryByText("First Member")).toBeNull();
  expect(screen.getByText("Second Member")).toBeTruthy();
  expect(screen.queryByText("Failed to refresh form responses")).toBeNull();
});

it("shows no previous action's responses while the next action's variants load", async () => {
  const view = renderTab();
  await screen.findByText("Withdrew");

  variantsHeld = hold().held;
  view.rerender(tab(2));

  expect(await screen.findByText("Loading responses...")).toBeTruthy();
  expect(screen.queryByText("Withdrawn Member")).toBeNull();
});
