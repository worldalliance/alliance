import type { FormSummaryDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import FormsPage from "./FormsPage";

afterEach(cleanup);

const form = (overrides: Partial<FormSummaryDto> & { id: number }) => ({
  title: `Form title ${overrides.id}`,
  slug: `form-${overrides.id}`,
  formSnapshotId: 1,
  displaySlug: `form-${overrides.id}`,
  schemaCounts: { pages: 2, fields: 5 },
  ...overrides,
});

let forms: FormSummaryDto[] = [];
let listStatus = 200;
let countsStatus = 200;
let deleteStatus = 200;
let deleted: string[] = [];

serveApi(
  routes({
    "GET /tasks/listForms": () =>
      listStatus === 200
        ? Response.json(forms)
        : Response.json({}, { status: listStatus }),
    "POST /tasks/responses/counts": async ({ request }) => {
      if (countsStatus !== 200) return Response.json({}, { status: 500 });
      const { formIds } = (await request.json()) as { formIds: number[] };
      return Response.json(
        formIds.map((formId) => ({ formId, count: formId === 3 ? 4 : 0 })),
      );
    },
    "DELETE /tasks/:id": ({ params }) => {
      deleted.push(String(params.id));
      if (deleteStatus !== 200) {
        return Response.json(
          { message: "Formulas read this form's answers" },
          { status: deleteStatus },
        );
      }
      forms = forms.filter((f) => String(f.id) !== String(params.id));
      return Response.json({});
    },
  }),
);

beforeEach(() => {
  forms = [
    form({
      id: 3,
      title: "Intake",
      usedInAction: { id: 12, name: "Call your MP" },
    }),
    form({ id: 5, title: "", schemaCounts: undefined }),
  ];
  listStatus = 200;
  countsStatus = 200;
  deleteStatus = 200;
  deleted = [];
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/tasks/forms"]}>
      <ToastProvider>
        <FormsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const rowOf = async (name: string) => {
  const link = await screen.findByRole("link", { name });
  const row = link.closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
};

it("labels each form by its task and opens a linked form's builder in the task", async () => {
  renderPage();

  const intake = await rowOf("Intake");
  expect(
    intake.getByRole("link", { name: "Intake" }).getAttribute("href"),
  ).toBe("/tasks/12?tab=form");
  expect(
    intake.getByRole("link", { name: "Call your MP" }).getAttribute("href"),
  ).toBe("/tasks/12");
  expect(intake.getByText("2")).toBeTruthy();
  expect(intake.getByText("5")).toBeTruthy();

  const untitled = await rowOf("Form 5");
  expect(
    untitled.getByRole("link", { name: "Form 5" }).getAttribute("href"),
  ).toBe("/tasks/forms/5");
  expect(
    untitled
      .getAllByRole("link")
      .some((link) => /^\/tasks\/\d+$/.test(link.getAttribute("href") ?? "")),
  ).toBe(false);
  expect(untitled.queryByText("No task")).toBeNull();
  expect(untitled.getByText("Unreadable schema")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /new form/i })).toBeNull();
});

it("links each count to the form's responses", async () => {
  renderPage();

  const count = await screen.findByRole("link", {
    name: "Responses: Intake, form 3, 4",
  });
  expect(count.getAttribute("href")).toBe("/tasks/forms/3?tab=responses");
});

it("says when the counts failed, keeping each form's way to its responses", async () => {
  countsStatus = 500;
  renderPage();

  expect(
    await screen.findByRole("link", {
      name: "Responses: Intake, form 3, Couldn't load the response count",
    }),
  ).toBeTruthy();
  expect(screen.getByText(/Couldn't load some response counts/)).toBeTruthy();
});

it("says when the forms failed to load", async () => {
  listStatus = 500;
  renderPage();

  expect(await screen.findByText("Couldn't load forms")).toBeTruthy();
});

it("says what deleting does before deleting a linked form", async () => {
  renderPage();
  await screen.findByRole("link", { name: "Responses: Intake, form 3, 4" });

  fireEvent.click(
    screen.getByRole("button", { name: "Delete: Intake, form 3" }),
  );
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText(/its 4 responses/)).toBeTruthy();
  expect(
    dialog.getByText(/the task completions those responses recorded/),
  ).toBeTruthy();
  fireEvent.click(dialog.getByRole("button", { name: "Delete form" }));

  expect(await screen.findByText("Form deleted")).toBeTruthy();
  expect(deleted).toEqual(["3"]);
  expect(screen.queryByRole("link", { name: "Intake" })).toBeNull();
});

it("says why a delete was refused, keeping the form", async () => {
  deleteStatus = 409;
  renderPage();
  await screen.findByRole("link", { name: "Form 5" });

  fireEvent.click(
    screen.getByRole("button", { name: "Delete: Form 5, form 5" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete form",
    }),
  );

  expect(
    await screen.findByText(
      "Couldn't delete “Form 5”: Formulas read this form's answers",
    ),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Form 5" })).toBeTruthy();
});
