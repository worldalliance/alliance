import { formSchema } from "@alliance/common/forms/form-schema";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { FormWithSchema } from "../../components/FormResponsesView";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import ActionReadinessChecklist from "./ActionReadinessChecklist";

const Checklist = ({
  action = makeParsedAction({ shortDescription: "Ready" }),
  taskForm = null,
}: {
  action?: ParsedActionDto;
  taskForm?: FormWithSchema | null;
}) => {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <ActionReadinessChecklist
      action={action}
      taskForm={taskForm}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
    />
  );
};

it("names what is missing while collapsed, and lists every item when open", () => {
  render(<Checklist />);

  expect(screen.getByText(/^Missing: /).textContent).toBe(
    "Missing: Body, Time estimate, Suite, Project, Cohort, Authors, Task form, Image, Output view",
  );
  expect(screen.queryByRole("listitem")).toBeNull();
  const toggle = screen.getByRole("button", { name: "Checklist" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.hasAttribute("aria-controls")).toBe(false);

  fireEvent.click(toggle);

  expect(screen.queryByText(/^Missing: /)).toBeNull();
  expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
  expect(screen.getAllByRole("img", { name: "Missing" })).toHaveLength(9);
  expect(screen.getAllByRole("img", { name: "Ready" })).toHaveLength(2);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getAllByRole("listitem")[0].parentElement?.id).toBe(
    toggle.getAttribute("aria-controls"),
  );
});

it("says nothing is missing when every item is ready", () => {
  render(
    <Checklist
      action={makeParsedAction({
        shortDescription: "Ready",
        body: "Call your representative.",
        timeEstimate: 5,
        suite: {
          id: 3,
          name: "Spring",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          events: [],
        },
        project: { id: 2, name: "Climate", category: [] },
        cohortExpression: { type: "Manual", userIds: [1] },
        authors: [makeProfile(1)],
        taskFormId: 5,
        image: "image.png",
      })}
      taskForm={{
        id: 5,
        title: "Form",
        formSnapshotId: 1,
        schema: formSchema.parse({
          pages: [],
          outputViews: [{ type: "card", id: "card", blocks: [] }],
        }),
      }}
    />,
  );

  expect(screen.queryByText(/^Missing: /)).toBeNull();
  expect(screen.getByText("11/11 ready")).toBeTruthy();
});
