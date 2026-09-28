import type { CohortExpression } from "@alliance/common/cohort-expression";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CohortExpressionBuilder from "./CohortExpressionBuilder";

afterEach(cleanup);

const renderBuilder = (
  value: CohortExpression,
  onChange: (value: CohortExpression | null) => void = () => {},
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <CohortExpressionBuilder
          value={value}
          onChange={onChange}
          availableTags={[]}
          availableActions={[{ id: 1, name: "Call your rep" }]}
          availableUsers={[]}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );

const typeSelect = (type: string) => {
  const select = screen
    .getAllByRole<HTMLSelectElement>("combobox")
    .find((element) => element.value === type);
  if (!select) throw new Error(`no type select showing ${type}`);
  return select;
};

const optionValues = (select: HTMLSelectElement) =>
  Array.from(select.options).map((option) => option.value);

describe("CohortExpressionBuilder", () => {
  it("doesn't offer In-Progress Action for a new condition", () => {
    renderBuilder({ type: "CompletedAction", actionId: 1 });

    expect(optionValues(typeSelect("CompletedAction"))).not.toContain(
      "InProgressAction",
    );
  });

  it("locks an existing In-Progress Action condition's action but lets it change type", () => {
    const onChange = jest.fn();
    renderBuilder({ type: "InProgressAction", actionId: 1 }, onChange);

    fireEvent.change(typeSelect("InProgressAction"), {
      target: { value: "CompletedAction" },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CompletedAction" }),
    );
    const actionSelect = screen
      .getAllByRole<HTMLSelectElement>("combobox")
      .find((element) => element.value === "1");
    expect(actionSelect?.disabled).toBe(true);
    expect(screen.getByText(/Can't be added or edited anymore/)).toBeDefined();
  });
});
