import type { AnyField } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "./customValidatorDrafts";
import { renderFieldEditor } from "./fieldEditors";

afterEach(cleanup);
serveApi(routes({}));

describe("label-only field editors", () => {
  it.each(["date", "email", "file", "time", "timezone"] as const)(
    "updates a %s field's required flag",
    (kind) => {
      const onUpdate = jest.fn();
      const field = {
        id: "f",
        type: "input",
        kind,
        label: "Label",
      } satisfies AnyField;
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
                {renderFieldEditor({ field, onUpdate, onRemove() {} })}
              </CustomValidatorDraftsContext.Provider>
            </SiteAppProvider>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole("checkbox", { name: "Required" }));
      expect(onUpdate).toHaveBeenCalledWith({ required: true });
    },
  );
});
