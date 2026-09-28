import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { EditableRangeField } from "./EditableRangeField";

afterEach(cleanup);
serveApi(routes({}));

function renderEditor(optionCount: number | undefined) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <CustomValidatorDraftsContext.Provider
            value={{
              drafts: {},
              setDraft() {},
              removeDraft() {},
              createDraftId: () => -1,
            }}
          >
            <EditableRangeField
              field={{
                id: "scale",
                type: "input",
                kind: "range",
                label: "Scale",
                optionCount,
              }}
              onUpdate={() => {}}
              onRemove={() => {}}
            />
          </CustomValidatorDraftsContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const [count, defaultSelection] = screen.getAllByRole("spinbutton");
  return { count, defaultSelection };
}

describe("EditableRangeField", () => {
  it("bounds the option count input to what save accepts", () => {
    const { count } = renderEditor(10);
    expect(count.getAttribute("min")).toBe("2");
    expect(count.getAttribute("max")).toBe("50");
  });

  it.each([
    [undefined, "10"],
    [80, "50"],
  ])(
    "caps the default selection at the rendered count for optionCount=%p",
    (optionCount, max) => {
      expect(
        renderEditor(optionCount).defaultSelection.getAttribute("max"),
      ).toBe(max);
    },
  );
});
