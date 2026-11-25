import type {
  AnyField,
  FormSchema,
  FormValue,
} from "@alliance/common/forms/form-schema";
import type { FormResponseOutputDto } from "@alliance/shared/client";
import { captureErrors } from "@alliance/shared/lib/testing/captureErrors";
import { render, screen } from "@testing-library/react";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import { OutputRenderer } from "./OutputRenderer";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "joined", type: "input", kind: "text", label: "Joined" },
        { id: "note", type: "input", kind: "textarea", label: "Note" },
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
            { id: "scan", type: "input", kind: "file", label: "Scan" },
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
    {
      type: "default",
      id: "plain",
      blocks: [
        { id: "b2", fieldId: "note", showLabel: true },
        { id: "b3", fieldId: "people", showLabel: true },
      ],
    },
    {
      type: "default",
      id: "headers",
      blocks: [
        { type: "display", kind: "header", id: "h1", text: "About" },
        { id: "b4", fieldId: "note", showLabel: true },
        { type: "display", kind: "header", id: "h2", text: "More" },
      ],
    },
  ],
};

const submission: FormResponseOutputDto = {
  id: 1,
  formId: 1,
  answers: {},
  publicAnswers: { note: true, people: true, sig: true },
  deviceType: null,
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
    const fromApi: FormResponseOutputDto = {
      ...submission,
      answers: { people: [{ name: "Ada", phone: "typed on a phone" }] },
    };
    render(
      <SiteAppProvider>
        <OutputRenderer schema={schema} viewId="v1" submission={fromApi} />
      </SiteAppProvider>,
    );

    expect(screen.getByDisplayValue("typed on a phone")).toBeTruthy();
  });
});

describe("OutputRenderer plain", () => {
  const renderPlain = (
    answers: Record<string, FormValue>,
    { viewId = "plain", from = schema } = {},
  ) =>
    render(
      <SiteAppProvider>
        <OutputRenderer
          schema={from}
          viewId={viewId}
          deviceType="desktop"
          submission={{ ...submission, answers }}
          plain
        />
      </SiteAppProvider>,
    );

  it("shows a written answer as body text that keeps its line breaks", () => {
    renderPlain({ note: "line one\nline two" });

    const note = screen.getByText(/line one/);
    expect(note.textContent).toBe("line one\nline two");
    expect(note.className).toContain("whitespace-pre-line");
    expect(note.className).toContain("text-base");
    expect(screen.queryByText("Note")).toBeNull();
  });

  it("shows a list's rows as text, leaving out cells the response hides", () => {
    renderPlain({
      joined: "yes",
      people: [
        { name: "Ada", secret: "kept" },
        { name: "Grace", phone: "typed on a phone" },
      ],
    });

    expect(screen.getByText(/Ada/).textContent).toBe("Ada, kept\nGrace");
    expect(screen.queryByText("People")).toBeNull();
  });

  it("shows the uploads in a list's rows, a row with only an upload included", () => {
    renderPlain({
      people: [
        { scan: "uploads/b.png" },
        { name: "Lease", scan: "uploads/a.png" },
        { name: "Ada" },
      ],
    });

    expect(screen.getByText(/Lease/).textContent).toBe("Lease\nAda");
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("keeps the space above a header that follows an answer", () => {
    renderPlain({ note: "Hello" }, { viewId: "headers" });

    const wrapper = (text: string) =>
      screen.getByText(text).closest(".space-y-2 > *");
    expect(wrapper("About")?.classList.contains("pt-4")).toBe(false);
    expect(wrapper("More")?.classList.contains("pt-4")).toBe(true);
  });

  it("shows an answer of a field kind this build doesn't know as text", () => {
    const future: AnyField = JSON.parse(
      '{ "id": "sig", "type": "input", "kind": "future", "label": "Sig" }',
    );
    renderPlain(
      { sig: "Ada L." },
      {
        from: {
          pages: [{ id: "p1", fields: [future] }],
          outputViews: [
            {
              type: "default",
              id: "plain",
              blocks: [{ id: "b1", fieldId: "sig" }],
            },
          ],
        },
      },
    );

    expect(screen.getByText("Ada L.")).toBeTruthy();
  });
});
