import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CohortExpressionBuilder, {
  ActionSelectEditor,
  TagEditor,
} from "./CohortExpressionBuilder";

afterEach(cleanup);

const availableTags = [
  {
    id: "tag-1",
    name: "non-US",
    description: "",
    publicDisplayName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    users: [],
  },
];

const renderTagEditor = (
  tagId: string,
  { tagsLoading = false, tagsError = false } = {},
) =>
  render(
    <TagEditor
      value={{ type: "Tag", tagId }}
      onChange={jest.fn()}
      availableTags={availableTags}
      tagsLoading={tagsLoading}
      tagsError={tagsError}
    />,
  );

const selectedLabel = () =>
  screen.getByRole<HTMLSelectElement>("combobox").selectedOptions[0]
    .textContent;

describe("TagEditor", () => {
  it("shows the selected tag's name", () => {
    renderTagEditor("tag-1");

    expect(selectedLabel()).toBe("non-US");
  });

  it("shows a tag that no longer exists as deleted rather than unset", () => {
    renderTagEditor("gone");

    expect(selectedLabel()).toBe("Deleted tag");
  });

  it("does not call a tag deleted while tags are loading", () => {
    renderTagEditor("gone", { tagsLoading: true });

    expect(selectedLabel()).toBe("Loading tags…");
  });

  it("does not call a tag deleted when the tags failed to load", () => {
    renderTagEditor("gone", { tagsError: true });

    expect(selectedLabel()).toBe("Couldn't load tags");
  });
});

describe("ActionSelectEditor", () => {
  const renderActionSelectEditor = (
    actionId: number,
    { actionsLoading = false, actionsError = false } = {},
  ) =>
    render(
      <ActionSelectEditor
        value={{ type: "CompletedAction", actionId }}
        onChange={jest.fn()}
        availableActions={
          actionsLoading || actionsError ? [] : [{ id: 7, name: "Sign up" }]
        }
        actionsLoading={actionsLoading}
        actionsError={actionsError}
      />,
    );

  it("shows the saved action once actions load", () => {
    renderActionSelectEditor(7);

    expect(selectedLabel()).toBe("Sign up");
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", false);
  });

  it("disables the select and says so while actions load", () => {
    renderActionSelectEditor(7, { actionsLoading: true });

    expect(selectedLabel()).toBe("Loading actions…");
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
  });

  it("shows an action that no longer exists as deleted rather than unset", () => {
    renderActionSelectEditor(99);

    expect(selectedLabel()).toBe("Deleted action");
  });

  it("does not call an action deleted when the actions failed to load", () => {
    renderActionSelectEditor(7, { actionsError: true });

    expect(selectedLabel()).toBe("Couldn't load actions");
  });

  it.each([0, NaN])("shows action id %p as unset", (actionId) => {
    renderActionSelectEditor(actionId);

    expect(selectedLabel()).toBe("Select action...");
  });

  it("says so for an unset action when the actions failed to load", () => {
    renderActionSelectEditor(0, { actionsError: true });

    expect(selectedLabel()).toBe("Couldn't load actions");
  });
});

describe("CohortExpressionBuilder", () => {
  const renderCompareSelect = ({
    actionsLoading = false,
    actionsError = false,
  }) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <CohortExpressionBuilder
            value={null}
            onChange={jest.fn()}
            availableTags={availableTags}
            tagsLoading={false}
            tagsError={false}
            availableActions={[]}
            actionsLoading={actionsLoading}
            actionsError={actionsError}
            availableUsers={[]}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Compare to another action" }),
    );
  };

  it("disables the compare select and says so while actions load", () => {
    renderCompareSelect({ actionsLoading: true });

    expect(selectedLabel()).toBe("Loading actions…");
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
  });

  it("says so in the compare select when actions failed to load", () => {
    renderCompareSelect({ actionsError: true });

    expect(selectedLabel()).toBe("Couldn't load actions");
  });
});
