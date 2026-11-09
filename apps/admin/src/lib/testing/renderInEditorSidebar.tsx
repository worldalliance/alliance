import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { CustomValidatorDraftsContext } from "../../components/form-fields/customValidatorDrafts";
import { EditorSidebar } from "./EditorSidebar";

function InEditorSidebar({ children }: { children: ReactNode }) {
  return (
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
          <EditorSidebar>{children}</EditorSidebar>
        </CustomValidatorDraftsContext.Provider>
      </SiteAppProvider>
    </MemoryRouter>
  );
}

/** Renders a field editor in its settings sidebar; `rerender` wraps the same way. */
export function renderInEditorSidebar(editor: ReactNode) {
  const result = render(
    <InEditorSidebar>{editor}</InEditorSidebar>,
    queryWrapper(),
  );
  return {
    ...result,
    rerender: (next: ReactNode) =>
      result.rerender(<InEditorSidebar>{next}</InEditorSidebar>),
  };
}
