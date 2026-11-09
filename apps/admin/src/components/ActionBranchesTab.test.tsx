import type {
  ActionBranchDto,
  ActionFormAssignmentDto,
  MoveToBranchDto,
  RerouteActionBranchesDto,
} from "@alliance/shared/client";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionBranchesTab from "./ActionBranchesTab";

const branch = (
  overrides: Pick<ActionBranchDto, "id" | "formId" | "name" | "position">,
): ActionBranchDto => ({
  actionId: 2,
  rule: { type: "AllMembers" },
  nameOverride: null,
  shortDescriptionOverride: null,
  bodyOverride: null,
  timeEstimateOverride: null,
  imageOverride: null,
  squareThumbnailImageOverride: null,
  squareThumbnailImageAltOverride: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...overrides,
});

const recruiting = branch({
  id: 1,
  formId: 11,
  name: "County recruiting",
  position: 0,
});
const staffed = branch({
  id: 2,
  formId: 12,
  name: "County staffed",
  position: 1,
});

const assignment: ActionFormAssignmentDto = {
  userId: 7,
  userName: "Sam Example",
  variantId: null,
  branchId: 1,
  assignedAt: "2026-10-01T00:00:00.000Z",
  overriddenAt: null,
  overriddenByName: null,
};

const NO_SOURCES = {
  availableTags: [],
  tagsLoading: false,
  tagsError: false,
  availableActions: [],
  actionsLoading: false,
  actionsError: false,
  availableUsers: [7, 8, 9].map((id) => ({
    id,
    name: `Member ${id}`,
    profilePicture: null,
  })),
  usersLoading: false,
  usersError: false,
};

let variantCount = 0;
let moved: MoveToBranchDto[] = [];
let saved: unknown[] = [];
let ordered: unknown[] = [];
let rerouted: RerouteActionBranchesDto[] = [];

serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /forms/:formId/slug": () => Response.json({ slug: "v1" }),
    "GET /actions/:id/branches": () =>
      Response.json({
        branches: [recruiting, staffed],
        stats: [{ branchId: 1, assigned: 1, submitted: 0 }],
      }),
    "GET /actions/:id/form-variants": () =>
      Response.json({
        variants: Array.from({ length: variantCount }, (_, id) => ({ id })),
        stats: [],
      }),
    "GET /actions/:id/form-assignments": () => Response.json([assignment]),
    "POST /actions/evaluate-cohort": () =>
      Response.json({ userIds: [7, 8, 9] }),
    "POST /actions/:id/branches/routing-preview": async ({ request }) => {
      const { rules }: { rules: unknown[] } = await request.json();
      return Response.json({
        branches: rules.map((_, index) => ({ userIds: [7 + index] })),
      });
    },
    "GET /actions/:id/branches/reroute": () =>
      Response.json({ moves: [{ userId: 7, fromBranchId: 1, toBranchId: 2 }] }),
    "POST /actions/:id/branches/reroute": async ({ request }) => {
      rerouted.push(await request.json());
      return Response.json({
        moves: [{ userId: 7, fromBranchId: 1, toBranchId: 2 }],
      });
    },
    "PATCH /actions/branches/:branchId": async ({ request }) => {
      saved.push(await request.json());
      return Response.json(recruiting);
    },
    "PUT /actions/:id/branches/order": async ({ request }) => {
      ordered.push(await request.json());
      return new Response(null, { status: 200 });
    },
    "POST /actions/:id/branches/move": async ({ request }) => {
      moved.push(await request.json());
      return new Response(null, { status: 201 });
    },
  }),
);

beforeEach(() => {
  variantCount = 0;
  moved = [];
  rerouted = [];
  saved = [];
  ordered = [];
});

const renderTab = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <ActionBranchesTab
          action={makeAction({ id: 2, taskFormId: 9 })}
          sources={NO_SOURCES}
        />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

it("shows the action's branches in routing order with their counts", async () => {
  renderTab();

  await screen.findByText("1 member on this branch, 0 submitted");
  const names = screen
    .getAllByRole("textbox", { name: "Branch name" })
    .map((input) => (input as HTMLTextAreaElement).value);
  expect(names).toEqual(["County recruiting", "County staffed"]);
});

it("locks adding branches while the action has random variants", async () => {
  variantCount = 1;
  renderTab();

  expect(
    await screen.findByText(/splits members into random variants/),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Add branch" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("re-routes the members the current rules would move, without notifying them when unticked", async () => {
  renderTab();
  fireEvent.click(
    await screen.findByRole("button", { name: "Re-route members" }),
  );
  expect(
    await screen.findByText("1 member: County recruiting → County staffed"),
  ).toBeTruthy();

  fireEvent.click(
    screen.getByRole("checkbox", { name: /Notify the 1 member/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Move 1 member" }));

  await waitFor(() => expect(rerouted).toEqual([{ notify: false }]));
});

it("moves one member to the branch staff pick and notifies them", async () => {
  renderTab();
  fireEvent.click(
    await screen.findByRole("button", { name: "Move Sam Example" }),
  );

  expect(
    (screen.getByRole("combobox", { name: "Move to" }) as HTMLSelectElement)
      .value,
  ).toBe("2");
  fireEvent.click(screen.getByRole("button", { name: "Move member" }));

  await waitFor(() =>
    expect(moved).toEqual([{ userId: 7, branchId: 2, notify: true }]),
  );
});

it("saves a branch's copy overrides, sending blanks as null so the action's own copy shows", async () => {
  renderTab();
  const [first] = await screen.findAllByText("What members on this branch see");
  fireEvent.click(first);
  fireEvent.change(screen.getAllByRole("textbox", { name: "Title" })[0], {
    target: { value: "Apply to be a poll worker" },
  });
  fireEvent.change(
    screen.getAllByRole("spinbutton", { name: "Time estimate (minutes)" })[0],
    { target: { value: "20" } },
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Save branch" })[0]);

  await waitFor(() =>
    expect(saved).toEqual([
      {
        name: "County recruiting",
        rule: { type: "AllMembers" },
        nameOverride: "Apply to be a poll worker",
        shortDescriptionOverride: null,
        bodyOverride: null,
        timeEstimateOverride: 20,
        squareThumbnailImageAltOverride: null,
      },
    ]),
  );
});

it("reorders branches by swapping neighbours", async () => {
  renderTab();
  const [down] = await screen.findAllByRole("button", {
    name: "Move branch down",
  });

  fireEvent.click(down);

  await waitFor(() => expect(ordered).toEqual([{ branchIds: [2, 1] }]));
});

it("marks the members a branch's rule matches but routes elsewhere apart from the ones it gets", async () => {
  renderTab();

  expect(
    await screen.findAllByText("1 of 3 routed to this branch"),
  ).toHaveLength(2);
  expect(screen.getAllByText("2 match its rule but go elsewhere")).toHaveLength(
    2,
  );
});
