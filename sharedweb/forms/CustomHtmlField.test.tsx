import type { CustomHtmlField as CustomHtmlFieldSchema } from "@alliance/common/forms/form-schema";
import { CUSTOM_HTML_SCOPE_ATTRIBUTE } from "@alliance/shared/forms/customHtml";
import { cleanup, fireEvent, render } from "@testing-library/react";
import CustomHtmlField from "./CustomHtmlField";

afterEach(cleanup);

const field = (
  overrides: Partial<CustomHtmlFieldSchema> = {},
): CustomHtmlFieldSchema => ({
  id: "field-1",
  type: "input",
  kind: "customhtml",
  label: "Custom",
  html: "",
  ...overrides,
});

describe("the custom HTML field", () => {
  it("captures the answer from the marked element on change", () => {
    const answers: string[] = [];
    const { container } = render(
      <CustomHtmlField
        field={field({
          html: `<select id="example" data-alliance-value>
                   <option value="y">Yes</option>
                   <option value="n">No</option>
                 </select>`,
        })}
        onChange={(next) => answers.push(next)}
      />,
    );

    const select = container.querySelector("#example") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "n" } });

    expect(answers.at(-1)).toBe("n");
  });

  it("adopts what the markup already shows, so a select starts answered", () => {
    const answers: string[] = [];
    render(
      <CustomHtmlField
        field={field({
          html: `<select data-alliance-value><option value="y">Yes</option></select>`,
        })}
        onChange={(next) => answers.push(next)}
      />,
    );

    expect(answers).toEqual(["y"]);
  });

  it("restores a saved answer onto the marked element", () => {
    // What makes navigating back to a page, or resuming a form, show the
    // member the answer they already gave.
    const { container } = render(
      <CustomHtmlField
        field={field({
          html: `<select id="example" data-alliance-value>
                   <option value="y">Yes</option>
                   <option value="n">No</option>
                 </select>`,
        })}
        value="n"
      />,
    );

    expect(
      (container.querySelector("#example") as HTMLSelectElement).value,
    ).toBe("n");
  });

  const radioGroup = `<div data-alliance-value>
    <label><input type="radio" name="focus" value="a"> A</label>
    <label><input type="radio" name="focus" value="b"> B</label>
  </div>`;

  it("reads a marked radio group as its checked radio's value", () => {
    const answers: string[] = [];
    const { container } = render(
      <CustomHtmlField
        field={field({ html: radioGroup })}
        onChange={(next) => answers.push(next)}
      />,
    );

    expect(answers).toEqual([]);
    fireEvent.click(container.querySelector('input[value="b"]')!);
    fireEvent.click(container.querySelector('input[value="a"]')!);

    expect(answers).toEqual(["b", "a"]);
  });

  it("restores a saved answer onto a marked radio group", () => {
    const { container } = render(
      <CustomHtmlField field={field({ html: radioGroup })} value="b" />,
    );

    expect(
      container.querySelector<HTMLInputElement>('input[value="b"]')?.checked,
    ).toBe(true);
  });

  it("lets an authored script publish an answer through Alliance.setValue", () => {
    const answers: string[] = [];
    const { container } = render(
      <CustomHtmlField
        field={field({
          html: `<button id="pick">pick</button>`,
          js: `Alliance.root.querySelector("#pick").onclick = () => Alliance.setValue("chosen");`,
        })}
        onChange={(next) => answers.push(next)}
      />,
    );

    fireEvent.click(container.querySelector("#pick") as HTMLButtonElement);

    expect(answers).toEqual(["chosen"]);
  });

  it("gives an authored script the saved answer as Alliance.value", () => {
    const { container } = render(
      <CustomHtmlField
        field={field({
          html: `<p id="out"></p>`,
          js: `Alliance.root.querySelector("#out").textContent = Alliance.value;`,
        })}
        value="saved"
      />,
    );

    expect(container.querySelector("#out")?.textContent).toBe("saved");
  });

  it("scopes authored css to its own wrapper", () => {
    const { container } = render(
      <CustomHtmlField
        field={field({ html: "<p>hi</p>", css: "select { border: 0 }" })}
      />,
    );

    const style = container.querySelector("style") as HTMLStyleElement;
    expect(style.textContent).toContain(`[${CUSTOM_HTML_SCOPE_ATTRIBUTE}=`);
    expect(style.textContent).not.toMatch(/^\s*select/);
  });

  it("survives a script that throws instead of taking the form down", () => {
    const { container } = render(
      <CustomHtmlField
        field={field({
          html: "<p id='here'>hi</p>",
          js: "throw new Error('boom')",
        })}
      />,
    );

    expect(container.querySelector("#here")?.textContent).toBe("hi");
  });

  it("runs cleanup the script registered when the field unmounts", () => {
    // Authored timers and document-level listeners would otherwise outlive the
    // field, which conditional visibility unmounts and remounts freely.
    const { unmount } = render(
      <CustomHtmlField
        field={field({
          html: "<p>hi</p>",
          js: `Alliance.onDestroy(() => { window.__customHtmlTornDown = true; });`,
        })}
      />,
    );

    expect(
      (window as unknown as Record<string, unknown>).__customHtmlTornDown,
    ).toBeUndefined();
    unmount();
    expect(
      (window as unknown as Record<string, unknown>).__customHtmlTornDown,
    ).toBe(true);
  });
});
