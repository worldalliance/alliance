import type {
  ActionFormAssignmentDto,
  MoveActionFormMemberDto,
  RerouteActionBranchesDto,
} from "@alliance/shared/client";
import { makeAction, makeFormVariant } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it } from "bun:test";
import { MemoryRouter } from "react-router";
import ActionFormVariantsTab from "./ActionFormVariantsTab";

const yes = makeFormVariant({
  id: 1,
  name: "County recruiting",
  splitValue: null,
  rule: { type: "AllMembers" },
});
const no = makeFormVariant({
  id: 2,
  formId: 12,
  name: "County staffed",
  splitValue: null,
  rule: { type: "AllMembers" },
  position: 1,
});

const assignment: ActionFormAssignmentDto = {
  userId: 7,
  userName: "Sam Example",
  variantId: 1,
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

let moved: MoveActionFormMemberDto[] = [];
let saved: unknown[] = [];
let ordered: unknown[] = [];
let rerouted: RerouteActionBranchesDto[] = [];

serveApi(
  routes({
    "GET /actions/:id/form-variants": () =>
      Response.json({ variants: [yes, no], stats: [] }),
    "GET /actions/:id/form-assignments": () => Response.json([assignment]),
    "POST /actions/evaluate-cohort": () =>
      Response.json({ userIds: [7, 8, 9] }),
    "POST /actions/:id/form-variants/routing-preview": async ({ request }) => {
      const { rules }: { rules: unknown[] } = await request.json();
      return Response.json({
        branches: rules.map((_, index) => ({ userIds: [7 + index] })),
      });
    },
    "GET /actions/:id/form-assignments/reroute": () =>
      Response.json({
        moves: [{ userId: 7, fromVariantId: 1, toVariantId: 2 }],
      }),
    "POST /actions/:id/form-assignments/reroute": async ({ request }) => {
      rerouted.push(await request.json());
      return Response.json({
        moves: [{ userId: 7, fromVariantId: 1, toVariantId: 2 }],
      });
    },
    "PATCH /actions/form-variants/:variantId": async ({ request }) => {
      saved.push(await request.json());
      return Response.json(yes);
    },
    "PUT /actions/:id/form-variants/order": async ({ request }) => {
      ordered.push(await request.json());
      return new Response(null, { status: 200 });
    },
    "POST /actions/:id/form-assignments/move": async ({ request }) => {
      moved.push(await request.json());
      return new Response(null, { status: 201 });
    },
  }),
);

beforeEach(() => {
  moved = [];
  rerouted = [];
  saved = [];
  ordered = [];
});

const renderTab = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <ActionFormVariantsTab
          action={makeAction({ id: 2, taskFormId: 9 })}
          sources={NO_SOURCES}
        />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

it("shows a branched action's branches in routing order", async () => {
  renderTab();

  expect(await screen.findByText("Form branches")).toBeTruthy();
  const names = screen
    .getAllByRole("textbox", { name: "Branch name (staff only)" })
    .map((input) => (input as HTMLInputElement).value);
  expect(names).toEqual(["County recruiting", "County staffed"]);
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
    expect(moved).toEqual([{ userId: 7, variantId: 2, notify: true }]),
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
        optional: false,
        optionalReason: null,
      },
    ]),
  );
});

it("saves a branch as optional with the reason its members see", async () => {
  renderTab();
  const [optional] = await screen.findAllByRole("checkbox", {
    name: "Optional for members on this branch",
  });
  fireEvent.click(optional);
  fireEvent.change(
    screen.getByRole("textbox", {
      name: "Why it's optional, shown to them (blank for a generic line)",
    }),
    { target: { value: "You're donating food this week." } },
  );

  fireEvent.click(screen.getAllByRole("button", { name: "Save branch" })[0]);

  await waitFor(() =>
    expect(saved).toEqual([
      expect.objectContaining({
        optional: true,
        optionalReason: "You're donating food this week.",
      }),
    ]),
  );
});

it("reorders branches by swapping neighbours", async () => {
  renderTab();
  const [down] = await screen.findAllByRole("button", {
    name: "Move branch down",
  });

  fireEvent.click(down);

  await waitFor(() => expect(ordered).toEqual([{ variantIds: [2, 1] }]));
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
