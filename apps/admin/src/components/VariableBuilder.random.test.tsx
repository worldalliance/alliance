import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen } from "@testing-library/react";
import { Harness, town } from "./VariableBuilder.testHarness";

serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([{ id: 1, title: "This one" }]),
  }),
);

const destination: FormSchema = {
  pages: [{ id: "p1", fields: [town] }],
  outputViews: [],
  variables: [
    {
      name: "recipient",
      inputs: { input1: { kind: "field", fieldId: "town" } },
      formula: "input1",
    },
  ],
};

const result = () => screen.getByText(/^Result:/).textContent;

describe("VariableBuilder random numbers", () => {
  it("offers a random number, previewed with a sample number", async () => {
    const saved: FormSchema[] = [];
    render(
      <Harness initial={destination} onSave={(next) => saved.push(next)} />,
    );

    const mode = await screen.findByLabelText("What input1 reads");
    expect(
      screen.getByRole("option", { name: "Random number (stable per member)" }),
    ).toBeTruthy();
    fireEvent.change(mode, { target: { value: "random" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "random",
    });
    expect(screen.queryByLabelText("Field read by input1")).toBeNull();
    expect(screen.getByText("input1: number")).toBeTruthy();

    const formula = document.querySelector("textarea");
    if (!formula) throw new Error("no formula box");
    fireEvent.change(formula, {
      target: { value: `["Bob", "Suzie", "Pam"][input1 % 3]` },
    });
    expect(result()).toContain("Result: Bob ");
    fireEvent.change(screen.getByLabelText("Sample number for input1"), {
      target: { value: "4" },
    });
    expect(result()).toContain("Result: Suzie ");

    fireEvent.change(mode, { target: { value: "answers" } });
    expect(saved.at(-1)?.variables?.[0].inputs.input1).toEqual({
      kind: "field",
      fieldId: "town",
    });
  });
});
