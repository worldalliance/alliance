import type { AnyField, FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Harness, town } from "./VariableBuilder.testHarness";

afterEach(cleanup);

const scoreField: AnyField = {
  id: "score",
  type: "input",
  kind: "number",
  label: "Score",
};

const surveySchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        scoreField,
        {
          id: "employers",
          type: "input",
          kind: "multiselect",
          label: "Employers",
          options: [
            { label: "Company A", value: "a" },
            { label: "Company B", value: "b" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const api = serveApi(
  routes({
    "GET /tasks/listForms": () =>
      Response.json([
        { id: 1, title: "This one" },
        { id: 9, title: "Survey" },
      ]),
    "GET /tasks/slug/:id": ({ params }) =>
      Response.json({
        id: Number(params.id),
        title: "Survey",
        formSnapshotId: 1,
        schema:
          params.id === "5"
            ? { ...surveySchema, pages: [{ id: "p1", fields: [scoreField] }] }
            : surveySchema,
      }),
  }),
);

const destination: FormSchema = {
  pages: [{ id: "p1", fields: [town] }],
  outputViews: [],
  variables: [
    {
      name: "count",
      inputs: { input1: { kind: "field", fieldId: "town" } },
      formula: "input1",
    },
  ],
};

const result = () => screen.getByText(/^Result:/).textContent;

const formulaBox = () => {
  const formula = document.querySelector("textarea");
  if (!formula) throw new Error("no formula box");
  return formula;
};

describe("VariableBuilder aggregate counts", () => {
  it("counts a multiselect picked from a form, previewed with sample counts", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness initial={destination} onSave={(next) => saved.push(next)} />,
    );

    const mode = await screen.findByLabelText("What input1 reads");
    await screen.findByText("Survey (#9)");
    fireEvent.change(mode, { target: { value: "counts" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "aggregate",
      sourceFormId: 1,
      fieldId: "",
    });
    expect(
      [
        ...(screen.getByLabelText("Form read by input1") as HTMLSelectElement)
          .options,
      ].map((option) => option.text),
    ).toEqual(["This form's submissions (#1)", "Survey (#9)"]);

    fireEvent.change(screen.getByLabelText("Form read by input1"), {
      target: { value: "9" },
    });
    await screen.findByText("Employers (multiselect) — employers");
    expect(screen.queryByText("Score (number) — score")).toBeNull();
    fireEvent.change(screen.getByLabelText("Field read by input1"), {
      target: { value: "employers" },
    });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "aggregate",
      sourceFormId: 9,
      fieldId: "employers",
    });
    expect(
      screen.getByText("input1: { [value: string]: number }"),
    ).toBeTruthy();

    fireEvent.change(formulaBox(), {
      target: { value: "input1['a'] + input1['b']" },
    });
    expect(result()).toContain("Result: 0 ");
    fireEvent.click(
      screen.getByTitle("Set every sample count for input1 to 25"),
    );
    expect(result()).toContain("Result: 50 ");
    fireEvent.change(screen.getByLabelText("Sample count for a in input1"), {
      target: { value: "1" },
    });
    expect(result()).toContain("Result: 26 ");

    fireEvent.change(screen.getByLabelText("Sample count for b in input1"), {
      target: { value: "-2" },
    });
    expect(
      screen.getByText(
        '"-2" isn\'t a whole number of members. Reads as undefined.',
      ),
    ).toBeTruthy();
  });

  it("keeps counting the form the input already reads", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "count",
              inputs: {
                input1: {
                  kind: "sourceField",
                  sourceFormId: 9,
                  fieldId: "score",
                },
              },
              formula: "input1",
            },
          ],
        }}
        onSave={(next) => saved.push(next)}
      />,
    );

    const mode = await screen.findByLabelText("What input1 reads");
    await screen.findByText("Survey (#9)");
    fireEvent.change(mode, { target: { value: "counts" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "aggregate",
      sourceFormId: 9,
      fieldId: "",
    });
    expect(result()).toContain("Result: — ");
  });

  it("counts the first other form from a form not saved yet", async () => {
    api.alsoServing({
      "GET /tasks/listForms": () => Response.json([{ id: 9, title: "Survey" }]),
    });
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={destination}
        onSave={(next) => saved.push(next)}
        unsaved
      />,
    );

    const mode = await screen.findByLabelText("What input1 reads");
    await screen.findByText("Survey (#9)");
    fireEvent.change(mode, { target: { value: "counts" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "aggregate",
      sourceFormId: 9,
      fieldId: "",
    });
  });

  it("can't count from a form not saved yet when there's no other form", async () => {
    let listed = false;
    api.alsoServing({
      "GET /tasks/listForms": () => {
        listed = true;
        return Response.json([]);
      },
    });
    render(<Harness initial={destination} onSave={() => {}} unsaved />);

    await waitFor(() => expect(listed).toBe(true));
    await act(async () => {});
    expect(
      screen.getByRole("option", { name: "Aggregate counts" }),
    ).toHaveProperty("disabled", true);
  });

  it("says when the counted form has no multiselect questions", async () => {
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "count",
              inputs: {
                input1: { kind: "aggregate", sourceFormId: 5, fieldId: "" },
              },
              formula: "0",
            },
          ],
        }}
        onSave={() => {}}
      />,
    );

    expect(
      await screen.findByText("No multiselect questions on this form"),
    ).toBeTruthy();
  });

  it("goes back to reading this form's answers", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "count",
              inputs: {
                input1: {
                  kind: "aggregate",
                  sourceFormId: 9,
                  fieldId: "employers",
                },
              },
              formula: "0",
            },
          ],
        }}
        onSave={(next) => saved.push(next)}
      />,
    );

    fireEvent.change(await screen.findByLabelText("What input1 reads"), {
      target: { value: "answers" },
    });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "field",
      fieldId: "town",
    });
  });
});
