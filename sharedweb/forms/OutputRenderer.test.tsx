import type { FormSchema, FormValue } from "@alliance/common/forms/form-schema";
import type { FormResponseOutputDto } from "@alliance/shared/client";
import { captureErrors } from "@alliance/shared/lib/testing/captureErrors";
import { cleanup, render, screen } from "@testing-library/react";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { OutputRenderer } from "./OutputRenderer";

afterEach(cleanup);

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "joined", type: "input", kind: "text", label: "Joined" },
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "People",
          fields: [
            { id: "name", type: "input", kind: "text", label: "Name" },
            {
              id: "secret",
              type: "input",
              kind: "text",
              label: "Secret",
              visibleIfFormula: {
                conditions: {
                  condition1: { kind: "equals", when: "joined", equals: "yes" },
                },
                formula: "condition1",
              },
            },
            {
              id: "phone",
              type: "input",
              kind: "text",
              label: "Phone",
              visibleIfFormula: {
                conditions: {
                  condition1: { kind: "deviceType", deviceType: ["mobile"] },
                },
                formula: "condition1",
              },
            },
          ],
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
    const logged = captureErrors(() => {
      renderSubmission({
        ...submission,
        answers: { people: [null, { name: "Ada" }] },
      });
    });

    expect(logged).toEqual([
      ["Stored answer for list field people is not a list of rows"],
    ]);

    expect(screen.queryByText("People")).toBeNull();
  });
});

describe("OutputRenderer list rows", () => {
  it("leaves out a cell the response's own answers hide", () => {
    renderOutput({ joined: "no", people: [{ name: "Ada", secret: "stale" }] });

    expect(screen.getByDisplayValue("Ada")).toBeTruthy();
    expect(screen.queryByText("Secret")).toBeNull();
    expect(screen.queryByDisplayValue("stale")).toBeNull();
  });

  it("draws a cell the response's own answers reveal", () => {
    renderOutput({ joined: "yes", people: [{ name: "Ada", secret: "kept" }] });

    expect(screen.getByText("Secret")).toBeTruthy();
    expect(screen.getByDisplayValue("kept")).toBeTruthy();
  });

  it("draws a device-gated cell when the response recorded no device", () => {
    // The API sends a missing device as null, which the generated type leaves out.
    const fromApi: FormResponseOutputDto = JSON.parse(
      JSON.stringify({
        ...submission,
        deviceType: null,
        answers: { people: [{ name: "Ada", phone: "typed on a phone" }] },
      }),
    );
    render(
      <SiteAppProvider>
        <OutputRenderer schema={schema} viewId="v1" submission={fromApi} />
      </SiteAppProvider>,
    );

    expect(screen.getByDisplayValue("typed on a phone")).toBeTruthy();
  });
});
