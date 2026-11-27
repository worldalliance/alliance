import { fireEvent, render, screen } from "@testing-library/react";
import ResponseReplay from "./ResponseReplay";

const renderEmpty = (filterActive: boolean) => {
  const onClearFilter = jest.fn();
  render(
    <ResponseReplay
      loading={false}
      error={null}
      form={null}
      filteredTotal={0}
      filterActive={filterActive}
      onClearFilter={onClearFilter}
      currentResponse={undefined}
      fieldsById={new Map()}
    />,
  );
  return onClearFilter;
};

it("says a form has no responses yet, with nothing to clear", () => {
  renderEmpty(false);

  expect(screen.getByText("No responses yet")).toBeTruthy();
  expect(screen.queryByText("Clear filters")).toBeNull();
});

it("offers to clear a filter that matches no responses", () => {
  const onClearFilter = renderEmpty(true);
  fireEvent.click(screen.getByText("Clear filters"));

  expect(screen.getByText("No results")).toBeTruthy();
  expect(onClearFilter).toHaveBeenCalled();
});
