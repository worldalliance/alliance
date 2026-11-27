import type { CohortExpression } from "@alliance/common/cohort-expression";
import { pending, type Pending } from "@alliance/shared/lib/testing/pending";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import CohortVisualization from "./CohortVisualization";

const users = [1, 2, 3].map((id) => ({
  id,
  name: `Member ${id}`,
  profilePicture: null,
}));

const matches: Record<string, number[]> = {
  AllMembers: [1, 2],
  Staff: [3],
  GroupLead: [2, 3],
  USMember: [1],
};
let refused: string | null = null;
let holding: string | null = null;
let held: Pending<void>[] = [];

serveApi(
  routes({
    "POST /actions/evaluate-cohort": async ({ request }) => {
      const { expression } = await request.json();
      if (expression.type === holding) await pending(held);
      return expression.type === refused
        ? Response.json({}, { status: 500 })
        : Response.json({ userIds: matches[expression.type] });
    },
  }),
);

afterEach(() => {
  refused = null;
  holding = null;
  held = [];
});

const dots = () =>
  [...document.querySelectorAll<HTMLElement>("[data-match]")].map(
    (dot) => dot.dataset.match,
  );

const gridClassName = () =>
  document.querySelector("[data-match]")?.parentElement?.className;

const renderVisualization = (props: {
  expression: CohortExpression;
  selectedSubExpression?: CohortExpression;
  compareExpression?: CohortExpression;
}) =>
  render(
    <CohortVisualization
      users={users}
      {...props}
      selectedSubExpression={props.selectedSubExpression ?? null}
    />,
    queryWrapper(),
  );

describe("CohortVisualization", () => {
  it("counts the members the expression and the compared task match", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "Staff" },
    });

    await screen.findByText("2 of 3 members matched");
    await screen.findByText("1 in compared task");
  });

  it("marks the members both the expression and the compare action match", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "GroupLead" },
    });

    await screen.findByText("1 in both");
    expect(dots()).toEqual(["both", "cohort", "compare"]);
  });

  it("counts no one in both while a changed expression evaluates", async () => {
    holding = "USMember";
    const view = renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "GroupLead" },
    });
    await screen.findByText("1 in both");

    view.rerender(
      <CohortVisualization
        expression={{ type: "USMember" }}
        selectedSubExpression={null}
        users={users}
        compareExpression={{ type: "GroupLead" }}
      />,
    );

    await screen.findByText("Evaluating…");
    expect(screen.queryByText(/in both/)).toBeNull();
  });

  it("keeps the last result in the dimmed grid while a changed expression evaluates", async () => {
    holding = "Staff";
    const view = renderVisualization({ expression: { type: "AllMembers" } });
    await screen.findByText("2 of 3 members matched");

    view.rerender(
      <CohortVisualization
        expression={{ type: "Staff" }}
        selectedSubExpression={null}
        users={users}
      />,
    );

    await screen.findByText("Evaluating…");
    expect(dots()).toEqual(["cohort", "cohort", "none"]);
    expect(gridClassName()).toContain("opacity-40");
    held[0].resolve();
    await screen.findByText("1 of 3 members matched");
    expect(dots()).toEqual(["cohort", "none", "none"]);
  });

  it("says in words whether a searched member is in the highlighted condition", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "Member" },
    });

    expect(
      await screen.findAllByText("Not in highlighted condition"),
    ).toHaveLength(2);
    expect(screen.getAllByText("In highlighted condition")).toHaveLength(1);
  });

  it("labels no searched member while the cohort evaluates", async () => {
    holding = "AllMembers";
    renderVisualization({ expression: { type: "AllMembers" } });
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "Member 1" },
    });

    await screen.findByText("Evaluating…");
    await screen.findByText("Member 1");
    expect(screen.queryByText(/in cohort/i)).toBeNull();
    expect(gridClassName()).toContain("opacity-40");
    held[0].resolve();
    await screen.findByText("In cohort");
    expect(gridClassName()).not.toContain("opacity-40");
  });

  it("says the compare action is evaluating instead of counting no matches", async () => {
    holding = "Staff";
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "Staff" },
    });
    await screen.findByText("2 of 3 members matched");
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "Member 1" },
    });

    await screen.findByText("Evaluating compared task…");
    expect(screen.queryByText(/in compared task/i)).toBeNull();
    held[0].resolve();
    await screen.findByText("1 in compared task");
    await screen.findByText("Not in compared task");
  });

  it("says the cohort failed to evaluate instead of counting no matches", async () => {
    refused = "AllMembers";
    renderVisualization({ expression: { type: "AllMembers" } });

    await screen.findByText("Couldn't evaluate the cohort.");
    expect(screen.queryByText(/members matched/)).toBeNull();
    expect(dots()).toEqual([]);
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "Member 1" },
    });
    await screen.findByText("Member 1");
    expect(screen.queryByText(/in cohort/i)).toBeNull();
  });

  it("says a changed expression failed instead of keeping the last count", async () => {
    refused = "Staff";
    const view = renderVisualization({ expression: { type: "AllMembers" } });
    await screen.findByText("2 of 3 members matched");

    view.rerender(
      <CohortVisualization
        expression={{ type: "Staff" }}
        selectedSubExpression={null}
        users={users}
      />,
    );

    await screen.findByText("Couldn't evaluate the cohort.");
    expect(screen.queryByText(/members matched/)).toBeNull();
  });

  it("marks the members the selected condition matches", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });

    await screen.findByText("1 in highlighted condition");
    expect(dots()).toEqual(["cohort", "cohort", "highlighted"]);
  });

  it("drops the hovered member when a failed evaluation hides the grid", async () => {
    refused = "Staff";
    const view = renderVisualization({ expression: { type: "AllMembers" } });
    await screen.findByText("2 of 3 members matched");
    fireEvent.mouseEnter(
      document.querySelector("[data-match]") ?? document.body,
    );
    await screen.findAllByText("Member 1");
    const rerender = (expression: CohortExpression) =>
      view.rerender(
        <CohortVisualization
          expression={expression}
          selectedSubExpression={null}
          users={users}
        />,
      );

    rerender({ type: "Staff" });
    await screen.findByText("Couldn't evaluate the cohort.");
    rerender({ type: "AllMembers" });

    await screen.findByText("2 of 3 members matched");
    expect(screen.queryByText("Member 1")).toBeNull();
  });

  it("says the selected condition is evaluating", async () => {
    holding = "Staff";
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });

    await screen.findByText("Evaluating highlighted condition…");
    held[0].resolve();
    await screen.findByText("1 in highlighted condition");
  });

  it("says the selected condition failed to evaluate", async () => {
    refused = "Staff";
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });

    await screen.findByText("Couldn't evaluate the highlighted condition.");
    await screen.findByText("2 of 3 members matched");
    expect(dots()).not.toContain("highlighted");
  });

  it("says the compare action failed to evaluate", async () => {
    refused = "GroupLead";
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "GroupLead" },
    });

    await screen.findByText("Couldn't evaluate the compared task's cohort.");
    await screen.findByText("2 of 3 members matched");
    expect(dots()).toEqual(["cohort", "cohort", "none"]);
    expect(screen.queryByText(/in both/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "Member 1" },
    });
    await screen.findByText("In cohort");
    expect(screen.queryByText(/in compared task/i)).toBeNull();
  });
});

describe("CohortVisualization without a cohort or members", () => {
  it("says an empty expression matches no one rather than everyone", () => {
    render(
      <CohortVisualization
        expression={null}
        selectedSubExpression={null}
        users={users}
      />,
      queryWrapper(),
    );
    expect(
      screen.getByText("No conditions, so none of 3 members match"),
    ).toBeTruthy();
    expect(dots()).toEqual(["none", "none", "none"]);
  });

  it("says the members failed to load instead of showing none", () => {
    render(
      <CohortVisualization
        expression={{ type: "AllMembers" }}
        selectedSubExpression={null}
        users={[]}
        usersError
      />,
      queryWrapper(),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't load members, so who matches can't be shown.",
    );
  });
});
