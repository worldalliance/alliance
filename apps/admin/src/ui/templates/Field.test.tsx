import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "bun:test";
import { Input } from "../Input";
import { Field } from "./Form";

describe("Field with a node for its error", () => {
  it("ties a list of problems to the control, and treats an empty list as none", () => {
    const { rerender } = render(
      <Field
        label="Expression"
        error={
          <ul>
            <li>One</li>
            <li>Two</li>
          </ul>
        }
      >
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Expression" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby") ?? "";
    expect(
      document.getElementById(errorId)?.querySelectorAll("li"),
    ).toHaveLength(2);
    const problems: string[] = [];
    rerender(
      <Field
        label="Expression"
        error={problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      >
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
