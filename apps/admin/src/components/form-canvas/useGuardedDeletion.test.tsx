import { PlaceKind } from "@alliance/common/forms/form-conditions";
import { type Page } from "@alliance/common/forms/form-schema";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useGuardedDeletion } from "./useGuardedDeletion";

const pages: Page[] = [
  {
    id: "p1",
    fields: [
      { id: "a", type: "input", kind: "text", label: "A" },
      {
        id: "b",
        type: "input",
        kind: "text",
        label: "B",
        visibleIfFormula: {
          conditions: { c1: { kind: "hasValue", when: "a", hasValue: true } },
          formula: "c1",
        },
      },
    ],
  },
];

function Harness({ pages, run }: { pages: Page[]; run: () => void }) {
  const { guard, dialog } = useGuardedDeletion({ pages, groups: new Map() });
  return (
    <>
      <button
        type="button"
        onClick={() =>
          guard({ kind: PlaceKind.Element, pageIndex: 0, index: 0 }, run)
        }
      >
        Delete
      </button>
      {dialog}
    </>
  );
}

const renderHarness = (run: () => void) => {
  const view = render(
    <ToastProvider>
      <Harness pages={pages} run={run} />
    </ToastProvider>,
  );
  return (next: Page[]) =>
    view.rerender(
      <ToastProvider>
        <Harness pages={next} run={run} />
      </ToastProvider>,
    );
};

describe("useGuardedDeletion", () => {
  it("refuses a confirmation once the form changed under it", () => {
    const run = jest.fn();
    const rerender = renderHarness(run);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    rerender([...pages]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete question",
      }),
    );
    expect(run).not.toHaveBeenCalled();
    expect(
      screen.getByText(/The form changed while this was open/),
    ).toBeTruthy();
  });

  it("deletes once confirmed against the same form", () => {
    const run = jest.fn();
    renderHarness(run);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete question",
      }),
    );
    expect(run).toHaveBeenCalledTimes(1);
  });
});
