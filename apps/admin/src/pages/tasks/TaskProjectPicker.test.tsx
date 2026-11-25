import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TaskProjectPicker } from "./TaskProjectPicker";

afterEach(cleanup);

const project = (id: number, name: string) => ({ id, name, category: [] });

serveApi(
  routes({
    "GET /projects": () =>
      Response.json([
        project(1, "Winter heat campaign"),
        project(2, "Rent strike"),
        project(3, "Heat pump rebates"),
      ]),
  }),
);

test("finds a project by a word inside its name", async () => {
  render(
    <>
      <span id="project-label">Project</span>
      <TaskProjectPicker actionId={7} project={null} labelId="project-label" />
    </>,
    queryWrapper(),
  );
  const trigger = screen.getByRole("combobox", { name: "Project" });
  await waitFor(() => expect(trigger).toHaveProperty("disabled", false));
  fireEvent.click(trigger);
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Search options" }),
    { target: { value: "heat" } },
  );
  await waitFor(() =>
    expect(
      screen.getAllByRole("option").map((node) => node.textContent),
    ).toEqual(["Winter heat campaign", "Heat pump rebates"]),
  );
});
