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
  [
    ...document.querySelectorAll<HTMLElement>(".rounded-full.cursor-default"),
  ].map((dot) =>
    dot.style.background ? "striped" : dot.className.match(/bg-\S+/)?.[0],
  );

const gridClassName = () =>
  document.querySelector(".rounded-full.cursor-default")?.parentElement
    ?.className;

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
  it("counts the members the expression and the compare action match", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "Staff" },
    });

    await screen.findByText("2 of 3 members matched");
    await screen.findByText("1 in compare action");
  });

  it("marks the members both the expression and the compare action match", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "GroupLead" },
    });

    await screen.findByText("1 in both");
    expect(dots()).toEqual(["striped", "bg-emerald-500", "bg-violet-500"]);
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

    await screen.findByText("Evaluating...");
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

    await screen.findByText("Evaluating...");
    expect(dots()).toEqual(["bg-emerald-500", "bg-emerald-500", "bg-gray-200"]);
    expect(gridClassName()).toContain("opacity-40");
    held[0].resolve();
    await screen.findByText("1 of 3 members matched");
    expect(dots()).toEqual(["bg-emerald-500", "bg-gray-200", "bg-gray-200"]);
  });

  it("labels no searched member while the cohort evaluates", async () => {
    holding = "AllMembers";
    renderVisualization({ expression: { type: "AllMembers" } });
    fireEvent.change(screen.getByPlaceholderText("Search for a user..."), {
      target: { value: "Member 1" },
    });

    await screen.findByText("Evaluating...");
    await screen.findByText("Member 1");
    expect(screen.queryByText(/in cohort/)).toBeNull();
    expect(gridClassName()).toContain("opacity-40");
    held[0].resolve();
    await screen.findByText("in cohort");
    expect(gridClassName()).not.toContain("opacity-40");
  });

  it("says the compare action is evaluating instead of counting no matches", async () => {
    holding = "Staff";
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "Staff" },
    });
    await screen.findByText("2 of 3 members matched");
    fireEvent.change(screen.getByPlaceholderText("Search for a user..."), {
      target: { value: "Member 1" },
    });

    await screen.findByText("Evaluating compare action...");
    expect(screen.queryByText(/in compare/)).toBeNull();
    held[0].resolve();
    await screen.findByText("1 in compare action");
    await screen.findByText("not in compare");
  });

  it("says the cohort failed to evaluate instead of counting no matches", async () => {
    refused = "AllMembers";
    renderVisualization({ expression: { type: "AllMembers" } });

    await screen.findByText("Failed to evaluate the cohort.");
    expect(screen.queryByText(/members matched/)).toBeNull();
    expect(dots()).toEqual([]);
    fireEvent.change(screen.getByPlaceholderText("Search for a user..."), {
      target: { value: "Member 1" },
    });
    await screen.findByText("Member 1");
    expect(screen.queryByText(/in cohort/)).toBeNull();
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

    await screen.findByText("Failed to evaluate the cohort.");
    expect(screen.queryByText(/members matched/)).toBeNull();
  });

  it("marks the members the selected condition matches", async () => {
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });

    await screen.findByText("1 in selected condition");
    expect(dots()).toEqual(["bg-emerald-500", "bg-emerald-500", "bg-blue-500"]);
  });

  it("drops the hovered member when a failed evaluation hides the grid", async () => {
    refused = "Staff";
    const view = renderVisualization({ expression: { type: "AllMembers" } });
    await screen.findByText("2 of 3 members matched");
    fireEvent.mouseEnter(
      document.querySelector(".rounded-full.cursor-default") ?? document.body,
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
    await screen.findByText("Failed to evaluate the cohort.");
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

    await screen.findByText("Evaluating selected condition...");
    held[0].resolve();
    await screen.findByText("1 in selected condition");
  });

  it("says the selected condition failed to evaluate", async () => {
    refused = "Staff";
    renderVisualization({
      expression: { type: "AllMembers" },
      selectedSubExpression: { type: "Staff" },
    });

    await screen.findByText("Failed to evaluate the selected condition.");
    await screen.findByText("2 of 3 members matched");
    expect(dots()).not.toContain("bg-blue-500");
  });

  it("says the compare action failed to evaluate", async () => {
    refused = "GroupLead";
    renderVisualization({
      expression: { type: "AllMembers" },
      compareExpression: { type: "GroupLead" },
    });

    await screen.findByText("Failed to evaluate the compare action's cohort.");
    await screen.findByText("2 of 3 members matched");
    expect(dots()).toEqual(["bg-emerald-500", "bg-emerald-500", "bg-gray-200"]);
    expect(screen.queryByText(/in both/)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Search for a user..."), {
      target: { value: "Member 1" },
    });
    await screen.findByText("in cohort");
    expect(screen.queryByText(/in compare/)).toBeNull();
  });
});
