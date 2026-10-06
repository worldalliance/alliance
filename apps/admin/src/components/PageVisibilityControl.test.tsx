import type { Page } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { LocalExpressionBuffers } from "./form-fields/conditions/expressionBuffers";
import { CustomValidatorDraftsContext } from "./form-fields/customValidatorDrafts";
import { PageVisibilityControl } from "./PageVisibilityControl";

afterEach(cleanup);
serveApi(
  routes({
    "GET /tasks/listForms": () => Response.json([]),
    "GET /tasks/customValidators": () => Response.json([]),
  }),
);

const bare: Page = { id: "p1", title: "One", fields: [] };
const withCity: Page = {
  ...bare,
  visibleIfFormula: {
    conditions: { c1: { kind: "userHasCity", userHasCity: true } },
    formula: "c1",
  },
};

const queryClient = new QueryClient();
const withProviders = (node: ReactNode) => (
  <QueryClientProvider client={queryClient}>
    <CustomValidatorDraftsContext.Provider
      value={{
        drafts: {},
        setDraft() {},
        removeDraft() {},
        createDraftId: () => -1,
      }}
    >
      <LocalExpressionBuffers>{node}</LocalExpressionBuffers>
    </CustomValidatorDraftsContext.Provider>
  </QueryClientProvider>
);

const toggle = () =>
  screen.getByLabelText<HTMLInputElement>(
    "Use conditional visibility for this page",
  );

it("stays open after conditions that arrived without a click are removed", () => {
  const renderPage = (page: Page) =>
    withProviders(
      <PageVisibilityControl
        page={page}
        isFirstPage={false}
        previousFields={[]}
        onChange={() => {}}
      />,
    );

  const { rerender } = render(renderPage(bare));
  expect(toggle().checked).toBe(false);
  rerender(renderPage(withCity));
  expect(toggle().checked).toBe(true);
  rerender(renderPage(bare));
  expect(toggle().checked).toBe(true);
});

it("clears the page's conditions when unchecked", () => {
  let latest: Page = withCity;
  function Editor() {
    const [page, setPage] = useState(withCity);
    latest = page;
    return (
      <PageVisibilityControl
        page={page}
        isFirstPage={false}
        previousFields={[]}
        onChange={(updates) => setPage((prev) => ({ ...prev, ...updates }))}
      />
    );
  }

  render(withProviders(<Editor />));
  fireEvent.click(toggle());

  expect(latest.visibleIfFormula).toBeUndefined();
  expect(toggle().checked).toBe(false);
});
