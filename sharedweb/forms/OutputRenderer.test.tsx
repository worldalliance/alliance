import type { FormSchema, FormValue } from "@alliance/common/forms/form-schema";
import type { FormResponseOutputDto } from "@alliance/shared/client";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { OutputRenderer } from "./OutputRenderer";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          fields: [{ id: "name", type: "input", kind: "text", label: "Name" }],
        },
      ],
    },
  ],
  outputViews: [
    {
      type: "default",
      id: "v1",
      blocks: [{ id: "b1", fieldId: "people", showLabel: true }],
    },
  ],
};

const submission: FormResponseOutputDto = {
  id: 1,
  formId: 1,
  answers: {},
  publicAnswers: { people: true },
  schemaSnapshot: {},
  visibilityValidatorResults: {},
};

const renderSubmission = (stored: FormResponseOutputDto) =>
  render(
    <SiteAppProvider>
      <OutputRenderer
        schema={schema}
        viewId="v1"
        deviceType="desktop"
        submission={stored}
      />
    </SiteAppProvider>,
  );

const renderOutput = (answers: Record<string, FormValue>) =>
  renderSubmission({ ...submission, answers });

// A list card's box carries no role to query by, so it is found through the
// classes `Card` and the list branch of `RenderField` give it.
const cardBoxes = (container: HTMLElement) =>
  container.querySelectorAll("div.p-4.gap-4");

describe("OutputRenderer blank list cards", () => {
  it("leaves out a card that answers nothing", () => {
    const { container } = renderOutput({
      people: [{ name: "Ada" }, { name: "" }],
    });

    expect(cardBoxes(container)).toHaveLength(1);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByDisplayValue("Ada")).toBeTruthy();
  });

  it("leaves out a list whose cards answer nothing", () => {
    renderOutput({ people: [{ name: "" }, {}] });

    expect(screen.queryByText("People")).toBeNull();
  });

  it("leaves out a list whose answer is not a list of cards", () => {
    renderSubmission({
      ...submission,
      answers: { people: [null, { name: "Ada" }] },
    });

    expect(screen.queryByText("People")).toBeNull();
  });
});
