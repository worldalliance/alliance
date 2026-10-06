import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CustomValidatorDraftsContext } from "../customValidatorDrafts";
import { ConditionalVisibility } from "./ConditionalVisibility";
import {
  addRule,
  expression,
  formulaOf,
  isRed,
  latest,
  named,
  renderEditor,
} from "./conditionEditorTesting";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

const queryClient = new QueryClient();
const editorShowing = (visibleIfFormula: VisibleIfFormula) => (
  <QueryClientProvider client={queryClient}>
    <CustomValidatorDraftsContext.Provider
      value={{
        drafts: {},
        setDraft() {},
        removeDraft() {},
        createDraftId: () => -1,
      }}
    >
      <ConditionalVisibility
        field={{ id: "self", visibleIfFormula }}
        previousFields={[]}
        onChange={() => {}}
      />
    </CustomValidatorDraftsContext.Provider>
  </QueryClientProvider>
);
const conditions = { c1: isRed, c2: named };

it("keeps typed text while the saved formula still matches it, and follows a different one", () => {
  const { rerender } = render(
    editorShowing({ conditions, formula: formulaOf("NOT (c1 AND c2)") }),
  );
  fireEvent.change(expression(), { target: { value: "not (c1 and c2)" } });

  rerender(
    editorShowing({ conditions, formula: formulaOf("NOT (c1 AND c2)") }),
  );
  expect(expression().value).toBe("not (c1 and c2)");

  rerender(editorShowing({ conditions, formula: formulaOf("NOT (c1 OR c2)") }));
  expect(expression().value).toBe("NOT (c1 OR c2)");
});

it("keeps unsaved text when the saved formula changes under it", () => {
  const { rerender } = render(
    editorShowing({ conditions, formula: formulaOf("NOT (c1 AND c2)") }),
  );
  fireEvent.change(expression(), { target: { value: "c1 AND" } });

  rerender(editorShowing({ conditions, formula: formulaOf("NOT (c1 OR c2)") }));
  expect(expression().value).toBe("c1 AND");
});

it("asks for an expression once one is cleared, keeping the saved formula", () => {
  const formula = formulaOf("NOT (c1 AND c2)");
  renderEditor({ initial: { conditions, formula } });
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.change(expression(), { target: { value: "" } });
  expect(screen.getByRole("alert").textContent).toMatch(/Write an expression/);
  expect(latest()?.formula).toBe(formula);
});

it("binds a name typed before its rule exists once the rule is added", async () => {
  renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.change(expression(), {
    target: { value: "NOT condition1" },
  });
  expect(screen.getByRole("alert").textContent).toMatch(
    /No rule is named condition1/,
  );

  await addRule("Device");
  expect(latest()?.formula).toEqual(formulaOf("NOT condition1"));
  expect(expression().value).toBe("NOT condition1");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("treats cleared text on an unconditional element as nothing to fix", () => {
  renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Edit as expression" }));
  fireEvent.change(expression(), { target: { value: "c" } });
  fireEvent.change(expression(), { target: { value: "" } });

  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Use all/any rules" }),
  ).toBeTruthy();
  expect(latest()).toBeUndefined();
});
