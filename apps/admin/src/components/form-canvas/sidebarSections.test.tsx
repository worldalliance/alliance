import type { PageItem } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { renderBlockEditor } from "../display-blocks/blockEditors";
import { LocalExpressionBuffers } from "../form-fields/conditions/expressionBuffers";
import { CustomValidatorDraftsContext } from "../form-fields/customValidatorDrafts";
import { renderFieldEditor } from "../form-fields/fieldEditors";
import {
  VisibilityGroupContext,
  VisibilityGroupRoleKind,
} from "../VisibilityGroupContext";
import { SelectChildProvider } from "./ChildRows";
import {
  ALL_SECTIONS,
  SidebarSection,
  SidebarSections,
} from "./sidebarSections";

afterEach(cleanup);
serveApi(routes({}, () => Response.json([])));

function Sidebar({ initial }: { initial: PageItem }) {
  const [element, setElement] = useState(initial);
  const [section, setSection] = useState(SidebarSection.Content);
  const props = {
    onUpdate: (updates: Partial<PageItem>) =>
      setElement((current) => ({ ...current, ...updates }) as PageItem),
    onRemove: () => {},
  };
  return (
    <SidebarSections
      sections={ALL_SECTIONS}
      active={section}
      onSelect={setSection}
      actions={<button type="button">Delete question</button>}
    >
      <SelectChildProvider value={() => {}}>
        {element.type === "display"
          ? renderBlockEditor({ block: element, ...props })
          : renderFieldEditor({ field: element, ...props })}
      </SelectChildProvider>
    </SidebarSections>
  );
}

const renderSidebar = (element: PageItem, groupMember = false) =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <ToastProvider>
        <QueryClientProvider client={new QueryClient()}>
          <CustomValidatorDraftsContext.Provider
            value={{
              drafts: {},
              setDraft() {},
              removeDraft() {},
              createDraftId: () => -1,
            }}
          >
            <LocalExpressionBuffers>
              <VisibilityGroupContext.Provider
                value={
                  groupMember && element.id
                    ? {
                        elementId: element.id,
                        kind: VisibilityGroupRoleKind.Member,
                        detach() {},
                      }
                    : null
                }
              >
                <Sidebar initial={element} />
              </VisibilityGroupContext.Provider>
            </LocalExpressionBuffers>
          </CustomValidatorDraftsContext.Provider>
        </QueryClientProvider>
      </ToastProvider>
    </SiteOriginLinkProvider>,
  );

const panel = () => within(screen.getByRole("tabpanel"));
const openSection = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

describe("an editor in the settings sidebar", () => {
  it("splits a question's settings across sections, without its card", () => {
    renderSidebar({ id: "t", type: "input", kind: "text", label: "Town" });

    expect(panel().getByPlaceholderText("Enter placeholder text")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Extra form options" })).toBe(
      null,
    );
    expect(screen.queryByTitle("Remove field")).toBeNull();

    openSection("Conditions");
    expect(panel().getByRole("button", { name: "Add rule" })).toBeTruthy();

    openSection("Advanced");
    expect(panel().getByLabelText("Use custom validator")).toBeTruthy();
    expect(panel().getByText("Delete question")).toBeTruthy();
    expect(panel().queryByLabelText("Use conditional visibility")).toBeNull();
  });

  it("moves between sections with the arrow keys", () => {
    renderSidebar({ id: "t", type: "input", kind: "text", label: "Town" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Content" }), {
      key: "ArrowLeft",
    });
    expect(
      screen
        .getByRole("tab", { name: "Advanced" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: "Advanced" }),
    );
  });

  it("lists a list's sub-fields as rows rather than their editors", () => {
    renderSidebar({
      id: "l",
      type: "input",
      kind: "list",
      label: "Pets",
      fields: [{ id: "s", type: "input", kind: "text", label: "Name" }],
    });
    expect(
      panel().getByRole("button", { name: "Text Field: Name" }),
    ).toBeTruthy();
    expect(panel().queryByPlaceholderText("Enter placeholder text")).toBeNull();
  });

  it("drops a block's own preview, which the canvas already shows", () => {
    renderSidebar({ id: "b", type: "display", kind: "text", text: "Hi" });
    expect(screen.queryByText("Show preview")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Display block options" }),
    ).toBeNull();
  });

  it("drops every rule, and the editor's expression mode, in one click", () => {
    renderSidebar({
      id: "t",
      type: "input",
      kind: "text",
      label: "Town",
      visibleIfFormula: {
        conditions: {
          c1: { kind: "userHasCity", userHasCity: true },
          c2: { kind: "userHasCity", userHasCity: false },
        },
        formula: { op: "NOT", operand: { op: "AND", left: "c1", right: "c2" } },
      },
    });
    openSection("Conditions");
    expect(panel().getByRole("textbox", { name: "Expression" })).toBeTruthy();

    fireEvent.click(panel().getByText("Remove all conditions"));
    expect(panel().queryByRole("textbox", { name: "Expression" })).toBeNull();
    expect(panel().getByText(/^Always shown/)).toBeTruthy();
    expect(panel().queryByText("Remove all conditions")).toBeNull();
  });

  it("drops a block's rules too", () => {
    renderSidebar({
      id: "b",
      type: "display",
      kind: "text",
      text: "Hi",
      visibleIfFormula: {
        conditions: { c1: { kind: "userHasCity", userHasCity: true } },
        formula: "c1",
      },
    });
    openSection("Conditions");
    fireEvent.click(panel().getByText("Remove all conditions"));
    expect(panel().getByText(/^Always shown/)).toBeTruthy();
  });

  it("names where an extracted answer goes", () => {
    renderSidebar({
      id: "c",
      type: "input",
      kind: "checkbox",
      label: "Share",
      autoExtractUserData: { target: "shareInfoPublicly" },
    });
    openSection("Advanced");
    expect(
      panel().getByText("Extracting into: Share info publicly"),
    ).toBeTruthy();
  });

  it("defers a group member's conditions to its group", () => {
    renderSidebar(
      {
        id: "t",
        type: "input",
        kind: "text",
        label: "Town",
        visibleIfFormula: {
          conditions: { c1: { kind: "userHasCity", userHasCity: true } },
          formula: "c1",
        },
      },
      true,
    );
    openSection("Conditions");
    expect(
      panel().getByText("Visibility is shared with its group."),
    ).toBeTruthy();
    expect(panel().queryByRole("button", { name: "Add rule" })).toBeNull();
    expect(panel().queryByText("Remove all conditions")).toBeNull();
  });

  it("keeps a block's preview while it holds a user's content", async () => {
    renderSidebar({
      id: "b",
      type: "display",
      kind: "text",
      text: "Hi",
      manualPerUser: true,
      manualUserContent: { "7": { text: "Dear Ana" } },
    });
    expect(await screen.findByText("Show preview")).toBeTruthy();
  });

  it("mounts a section when first opened, and keeps it through a switch", () => {
    renderSidebar({ id: "t", type: "input", kind: "text", label: "Town" });
    expect(
      screen.queryByRole("button", { name: "Add rule", hidden: true }),
    ).toBeNull();

    openSection("Conditions");
    fireEvent.click(
      panel().getByRole("button", { name: "Edit as expression" }),
    );
    openSection("Content");
    openSection("Conditions");
    expect(panel().getByRole("textbox", { name: "Expression" })).toBeTruthy();
  });
});
