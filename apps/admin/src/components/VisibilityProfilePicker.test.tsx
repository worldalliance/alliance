import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, mock } from "bun:test";
import { VisibilityProfilePicker } from "./VisibilityProfilePicker";

const city: Condition = { kind: "userHasCity", userHasCity: true };
const veteran: Condition = { kind: "completedActionCount", atLeast: 3 };

const gatedBy = (conditions: Condition[]): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: conditions.map((condition, index) => ({
        id: `q${index}`,
        type: "input",
        kind: "text",
        label: `Question ${index}`,
        visibleIfFormula: { formula: "c1", conditions: { c1: condition } },
      })),
    },
  ],
  outputViews: [],
});

let profiles: { results: boolean[]; userIds: number[] }[] = [];
let requests: { schema: unknown; userIds: number[] }[] = [];
const api = serveApi(
  routes({
    "POST /tasks/visibilityProfiles": async ({ request }) => {
      requests.push(await request.json());
      return Response.json({ profiles });
    },
  }),
);
beforeEach(() => {
  profiles = [];
  requests = [];
});

const renderPicker = (params: {
  schema: FormSchema;
  userIds?: number[];
  selectedUserId?: number | null;
}) => {
  const onSelect = mock();
  const { wrapper } = queryWrapper();
  const view = render(
    <VisibilityProfilePicker
      schema={params.schema}
      userIds={params.userIds ?? [1, 2, 3]}
      selectedUserId={params.selectedUserId ?? null}
      onSelect={onSelect}
    />,
    { wrapper },
  );
  return { onSelect, ...view };
};

it("shows each group's verdict on the conditions that tell groups apart", async () => {
  profiles = [
    { results: [true, false], userIds: [2, 3] },
    { results: [true, true], userIds: [1] },
  ];
  const { onSelect } = renderPicker({
    schema: gatedBy([city, veteran]),
    selectedUserId: 1,
  });

  const cards = await screen.findAllByRole("radio");
  expect(cards.map((card) => card.textContent)).toEqual([
    "2 memberscompleted actions ≥ 3",
    "1 membercompleted actions ≥ 3",
  ]);
  expect(screen.queryByText(/has city/)).toBeNull();
  expect(cards.map((card) => card.getAttribute("aria-checked"))).toEqual([
    "false",
    "true",
  ]);
  expect(
    cards.map((card) =>
      card.querySelector("[aria-label]")?.getAttribute("aria-label"),
    ),
  ).toEqual(["Doesn't hold", "Holds"]);

  fireEvent.click(cards[0]);
  expect(onSelect).toHaveBeenCalledWith(2);
});

it("says so when every member sees the same version", async () => {
  profiles = [{ results: [false], userIds: [1, 2, 3] }];
  renderPicker({ schema: gatedBy([city]) });

  expect(await screen.findByText("All see the same version")).toBeTruthy();
});

it("asks for nothing when nothing in the form depends on the member", () => {
  const { container } = renderPicker({
    schema: gatedBy([{ kind: "deviceType", deviceType: ["mobile"] }]),
  });

  expect(container.textContent).toBe("");
  expect(requests).toEqual([]);
});

it("refuses verdicts that don't line up with the form's conditions", async () => {
  profiles = [{ results: [true, false], userIds: [1] }];
  renderPicker({ schema: gatedBy([city]) });

  expect(await screen.findByText(/Reload the page/)).toBeTruthy();
});

it("shows why grouping failed", async () => {
  api.alsoServing({
    "POST /tasks/visibilityProfiles": () =>
      Response.json(
        { message: "The form schema is invalid: pages" },
        { status: 400 },
      ),
  });
  renderPicker({ schema: gatedBy([city]) });

  expect(await screen.findByText(/The form schema is invalid/)).toBeTruthy();
});

it("warns that unsaved validators fail for everyone", async () => {
  profiles = [{ results: [false], userIds: [1, 2, 3] }];
  renderPicker({ schema: gatedBy([{ kind: "validator", validatorId: -1 }]) });

  expect(await screen.findByText(/Save the form/)).toBeTruthy();
});

it("asks once for members listed in any order or twice", async () => {
  profiles = [{ results: [true], userIds: [1, 2] }];
  const schema = gatedBy([city]);
  const { rerender } = renderPicker({ schema, userIds: [2, 1, 2] });
  await screen.findAllByRole("radio");

  rerender(
    <VisibilityProfilePicker
      schema={{ ...schema, pages: [...schema.pages] }}
      userIds={[1, 2]}
      selectedUserId={null}
      onSelect={() => {}}
    />,
  );
  await screen.findAllByRole("radio");

  expect(requests.map(({ userIds }) => userIds)).toEqual([[1, 2]]);
});

it("waits for a condition being edited to settle before asking again", async () => {
  profiles = [{ results: [true], userIds: [1] }];
  const at = (atLeast: number) => (
    <VisibilityProfilePicker
      schema={gatedBy([{ kind: "completedActionCount", atLeast }])}
      userIds={[1]}
      selectedUserId={null}
      onSelect={() => {}}
    />
  );
  const { wrapper } = queryWrapper();
  const { rerender } = render(at(1), { wrapper });
  await screen.findAllByRole("radio");

  rerender(at(12));
  rerender(at(123));
  await new Promise((resolve) => setTimeout(resolve, 700));
  await screen.findAllByRole("radio");

  expect(
    requests.map(
      ({ schema }) => JSON.stringify(schema).match(/"atLeast":(\d+)/)?.[1],
    ),
  ).toEqual(["1", "123"]);
});

it("names a saved validator and the tag it checks", async () => {
  api.alsoServing({
    "GET /tasks/findOneCustomValidator/:id": () =>
      Response.json({
        id: 4,
        type: "MemberTag",
        idArgument: "9",
        expression: null,
      }),
    "GET /tasks/customValidators": () =>
      Response.json([
        {
          name: "Member has tag",
          id: "MemberTag",
          withIdField: true,
          usableForVisibility: true,
        },
      ]),
    "GET /user/tags": () => Response.json([{ id: 9, name: "non-US" }]),
  });
  profiles = [
    { results: [false], userIds: [1, 2] },
    { results: [true], userIds: [3] },
  ];
  renderPicker({
    schema: gatedBy([
      { kind: "validator", validatorId: 4, resultEquals: false },
    ]),
  });

  expect(
    (await screen.findAllByText("Member has tag (non-US) fails")).length,
  ).toBe(2);
});
