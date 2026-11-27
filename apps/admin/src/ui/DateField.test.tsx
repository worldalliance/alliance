import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { DateField } from "./DateField";
import { Field } from "./templates/Form";

afterEach(cleanup);

describe("DateField", () => {
  it("shows its date and reports a picked one as YYYY-MM-DD", () => {
    const onChange = jest.fn();
    render(
      <DateField aria-label="From" value="2026-11-01" onChange={onChange} />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("From");
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-11-01");
    fireEvent.change(input, { target: { value: "2026-11-24" } });
    expect(onChange).toHaveBeenCalledWith("2026-11-24");
  });

  it("reports an empty string when cleared", () => {
    const onChange = jest.fn();
    render(
      <DateField aria-label="From" value="2026-11-01" onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("takes its id, description and invalid state from a Field", () => {
    render(
      <Field label="From" help="First day counted" error="Pick a date">
        {(control) => <DateField {...control} value="" onChange={() => {}} />}
      </Field>,
    );
    const input = screen.getByLabelText("From");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(
      screen.getByRole("alert").id,
    );
  });

  it("passes min, max and disabled to the input", () => {
    render(
      <DateField
        aria-label="To"
        value=""
        onChange={() => {}}
        min="2026-11-01"
        max="2026-11-30"
        disabled
      />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("To");
    expect(input.min).toBe("2026-11-01");
    expect(input.max).toBe("2026-11-30");
    expect(input.disabled).toBe(true);
  });
});
