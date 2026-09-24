import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Harness, town } from "./VariableBuilder.testHarness";

afterEach(cleanup);

const surveySchema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "score", type: "input", kind: "number", label: "Score" },
        {
          id: "pets",
          type: "input",
          kind: "list",
          label: "Pets",
          fields: [{ id: "pn", type: "input", kind: "text", label: "Pet" }],
        },
      ],
    },
  ],
  outputViews: [],
};

let formListFails = false;
beforeEach(() => {
  formListFails = false;
});

serveApi(
  routes({
    "GET /tasks/listForms": () =>
      formListFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json([
            { id: 1, title: "This one" },
            { id: 9, title: "Survey" },
          ]),
    "GET /tasks/slug/:id": ({ params }) =>
      params.id === "9"
        ? Response.json({
            id: 9,
            title: "Survey",
            formSnapshotId: 1,
            schema: surveySchema,
          })
        : Response.json({ message: "gone" }, { status: 404 }),
  }),
);

describe("VariableBuilder inputs from another form", () => {
  const destination: FormSchema = {
    pages: [{ id: "p1", fields: [town] }],
    outputViews: [],
    variables: [
      {
        name: "scores",
        inputs: { input1: { kind: "field", fieldId: "town" } },
        formula: "input1",
      },
    ],
  };

  it("reads a question picked from another form once per submission", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness initial={destination} onSave={(next) => saved.push(next)} />,
    );

    const formPicker = await screen.findByLabelText("Form read by input1");
    expect(
      [...(formPicker as HTMLSelectElement).options].map((o) => o.text),
    ).toEqual(["This form", "Survey (#9)"]);
    fireEvent.change(formPicker, { target: { value: "9" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "sourceField",
      fieldId: "",
      sourceFormId: 9,
    });

    await screen.findByText("Score (number) — score");
    fireEvent.change(screen.getByLabelText("Field read by input1"), {
      target: { value: "score" },
    });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "sourceField",
      fieldId: "score",
      sourceFormId: 9,
    });
    expect(screen.getByText("input1: (number | undefined)[]")).toBeTruthy();

    const formula = document.querySelector("textarea");
    if (!formula) throw new Error("no formula box");
    fireEvent.change(formula, {
      target: { value: 'input1.map(n => n ?? "-").join("/")' },
    });
    const addSubmission = screen.getByLabelText(
      "Add sample submission to input1",
    );
    fireEvent.click(addSubmission);
    fireEvent.click(addSubmission);
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 submission 2"),
      { target: { value: "7" } },
    );
    expect(screen.getByText("-/7")).toBeTruthy();

    fireEvent.click(
      screen.getByLabelText("Remove sample submission 1 of input1"),
    );
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("leaves a question unpicked on another form whose questions are already loaded", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "scores",
              inputs: {
                input1: {
                  kind: "sourceField",
                  fieldId: "score",
                  sourceFormId: 9,
                },
                input2: { kind: "field", fieldId: "town" },
              },
              formula: "input1",
            },
          ],
        }}
        onSave={(next) => saved.push(next)}
      />,
    );

    await screen.findByText("Score (number) — score");
    fireEvent.change(await screen.findByLabelText("Form read by input2"), {
      target: { value: "9" },
    });
    expect(saved.at(-1)?.variables?.[0].inputs.input2).toEqual({
      kind: "sourceField",
      fieldId: "",
      sourceFormId: 9,
    });
  });

  it("previews sample rows inside each submission of a list from another form", async () => {
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "pets",
              inputs: {
                input1: {
                  kind: "sourceList",
                  fieldId: "pets",
                  sourceFormId: 9,
                  properties: { pn: "pet" },
                },
              },
              formula:
                'input1.map(rows => rows.map(row => row.pet).join("+")).join("|")',
            },
          ],
        }}
        onSave={() => {}}
      />,
    );

    const addSubmission = await screen.findByLabelText(
      "Add sample submission to input1",
    );
    fireEvent.click(addSubmission);
    fireEvent.click(addSubmission);
    const addRow = screen.getByLabelText(
      "Add sample row to input1 submission 2",
    );
    fireEvent.click(addRow);
    fireEvent.click(addRow);
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 submission 2 row 1, Pet"),
      { target: { value: "Rex" } },
    );
    fireEvent.change(
      screen.getByLabelText("Sample answer for input1 submission 2 row 2, Pet"),
      { target: { value: "Tom" } },
    );

    expect(screen.getByText("|Rex+Tom")).toBeTruthy();
    expect(
      screen.getByLabelText<HTMLInputElement>("input1 property name for Pet")
        .value,
    ).toBe("pet");
  });

  it("doesn't flag a question while its form is loading", async () => {
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "scores",
              inputs: {
                input1: {
                  kind: "sourceField",
                  fieldId: "score",
                  sourceFormId: 9,
                },
              },
              formula: "input1.length",
            },
          ],
        }}
        onSave={() => {}}
      />,
    );

    const fieldPicker = screen.getByLabelText("Field read by input1");
    expect(screen.getByText("Loading questions…")).toBeTruthy();
    expect(fieldPicker.className).not.toContain("border-red-400");
    await screen.findByText("Score (number) — score");
  });

  it("flags a form that can't be loaded", async () => {
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "gone",
              inputs: {
                input1: {
                  kind: "sourceField",
                  fieldId: "score",
                  sourceFormId: 4,
                },
              },
              formula: "input1.length",
            },
          ],
        }}
        onSave={() => {}}
      />,
    );

    expect(screen.getByText("Form #4")).toBeTruthy();
    expect(screen.queryByText("Missing form — #4")).toBeNull();
    expect(await screen.findByText("Missing form — #4")).toBeTruthy();
    expect(
      await screen.findByText(
        "Could not load that form. It may have been deleted.",
      ),
    ).toBeTruthy();
  });

  it("says when the list of forms to read from couldn't load", async () => {
    formListFails = true;
    render(<Harness initial={destination} onSave={() => {}} />);

    expect(
      await screen.findByText("Could not load the list of forms."),
    ).toBeTruthy();
  });

  it("names output-view text that shows a variable reading another form", () => {
    render(
      <Harness
        initial={{
          ...destination,
          variables: [
            {
              name: "scores",
              inputs: {
                input1: {
                  kind: "sourceField",
                  fieldId: "score",
                  sourceFormId: 9,
                },
              },
              formula: "input1.length",
            },
          ],
          outputViews: [
            {
              id: "view",
              type: "default",
              blocks: [
                { id: "t", type: "display", kind: "text", text: "#{scores}" },
              ],
            },
          ],
        }}
        onSave={() => {}}
      />,
    );

    expect(screen.getByText(/Output views can't show a variable/)).toBeTruthy();
    expect(screen.getByText("in view › t.text")).toBeTruthy();
  });
});
