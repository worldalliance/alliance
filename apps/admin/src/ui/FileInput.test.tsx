import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { useState } from "react";
import { FileInput } from "./FileInput";
import { Field } from "./templates/Form";

afterEach(cleanup);

const file = (name: string) => new File(["x"], name, { type: "image/png" });

function Harness({
  multiple = false,
  emptyText,
}: {
  multiple?: boolean;
  emptyText?: string;
}) {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <>
      <Field label="Cover image" help="PNG or JPEG">
        {(control) => (
          <FileInput
            {...control}
            value={files}
            onChange={setFiles}
            multiple={multiple}
            emptyText={emptyText}
            accept="image/*"
          />
        )}
      </Field>
      <button type="button" onClick={() => setFiles([])}>
        Clear
      </button>
    </>
  );
}

const nativeInput = () =>
  screen.getByLabelText<HTMLInputElement>("Cover image");

describe("FileInput", () => {
  it("keeps a native file input, named by the field's label", () => {
    render(<Harness />);
    const input = nativeInput();
    expect(input.type).toBe("file");
    expect(input.accept).toBe("image/*");
    expect(input.multiple).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Choose file…").getAttribute("for")).toBe(input.id);
    expect(screen.getByText("No file chosen")).toBeTruthy();
  });

  it("reports the chosen file and shows its name, whole in the title", () => {
    render(<Harness />);
    fireEvent.change(nativeInput(), {
      target: { files: [file("a-very-long-cover-image-name.png")] },
    });
    const name = screen.getByText("a-very-long-cover-image-name.png");
    expect(name.title).toBe("a-very-long-cover-image-name.png");
    expect(name.className).toContain("truncate");
  });

  it("takes several files when multiple", () => {
    render(<Harness multiple />);
    expect(screen.getByText("Choose files…")).toBeTruthy();
    expect(screen.getByText("No files chosen")).toBeTruthy();
    expect(nativeInput().multiple).toBe(true);
    fireEvent.change(nativeInput(), {
      target: { files: [file("a.png"), file("b.png")] },
    });
    expect(screen.getByText("a.png, b.png")).toBeTruthy();
  });

  it("goes back to empty when the caller clears its value", () => {
    render(<Harness />);
    fireEvent.change(nativeInput(), { target: { files: [file("a.png")] } });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("No file chosen")).toBeTruthy();
    expect(nativeInput().value).toBe("");
  });

  it("says what was uploaded once the caller clears the value", () => {
    render(<Harness emptyText="Uploaded a.png" />);
    expect(screen.getByText("Uploaded a.png")).toBeTruthy();
  });

  it("passes disabled and the invalid state to the native input", () => {
    const onChange = jest.fn();
    render(
      <Field label="Cover image" error="Choose an image under 5 MB">
        {(control) => (
          <FileInput {...control} value={[]} onChange={onChange} disabled />
        )}
      </Field>,
    );
    expect(nativeInput().disabled).toBe(true);
    expect(nativeInput().getAttribute("aria-invalid")).toBe("true");
  });
});
