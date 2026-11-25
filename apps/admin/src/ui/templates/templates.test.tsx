import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { MemoryRouter, useLocation } from "react-router";
import { ShortcutsProvider } from "../../shell/shortcuts";
import { Input } from "../Input";
import { Field, SaveBar, SaveState } from "./Form";
import { BulkBar, SearchField } from "./List";
import { Page } from "./Page";
import { ContentState } from "./States";
import { SKELETON_DELAY_MS } from "./useDelayedFlag";
import { useUrlTab } from "./useUrlTab";

afterEach(cleanup);

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events", count: 1200 },
] as const;

function TabbedPage() {
  const [tab, setTab] = useUrlTab(TABS.map((t) => t.id));
  const { search } = useLocation();
  return (
    <Page
      title="Winter heat survey"
      breadcrumb={[{ label: "All tasks", to: "/tasks" }]}
      tabs={{ items: TABS, value: tab, onChange: setTab }}
    >
      <p>Body of {tab}</p>
      <output>{search}</output>
    </Page>
  );
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TabbedPage />
    </MemoryRouter>,
  );

describe("Page with tabs", () => {
  it("opens the first tab on the bare URL", () => {
    renderAt("/tasks/1");
    expect(
      screen.getByRole("tab", { name: "Overview", selected: true }),
    ).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "Body of overview",
    );
  });

  it("opens the tab the URL names", () => {
    renderAt("/tasks/1?tab=events");
    expect(
      screen.getByRole("tab", { name: "Events 1,200", selected: true }),
    ).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "Body of events",
    );
  });

  it("falls back to the first tab on an unknown value", () => {
    renderAt("/tasks/1?tab=nope");
    expect(
      screen.getByRole("tab", { name: "Overview", selected: true }),
    ).toBeTruthy();
  });

  it("writes the chosen tab to the URL, keeping other params, and clears it for the first", () => {
    renderAt("/tasks/1?q=heat");
    fireEvent.click(screen.getByRole("tab", { name: "Events 1,200" }));
    expect(screen.getByRole("status").textContent).toBe("?q=heat&tab=events");
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByRole("status").textContent).toBe("?q=heat");
  });

  it("renders the title as the page's one h1 and the breadcrumb as links", () => {
    renderAt("/tasks/1");
    expect(
      screen.getByRole("heading", { level: 1, name: "Winter heat survey" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("navigation", { name: "Breadcrumb" })
        .querySelector("a")
        ?.getAttribute("href"),
    ).toBe("/tasks");
  });
});

describe("ContentState", () => {
  const base = {
    loading: false,
    skeleton: <p>skeleton</p>,
    errorTitle: "Couldn't load suites",
    empty: false,
    emptyTitle: "No suites yet",
  };

  it("holds the skeleton back until the delay passes", () => {
    jest.useFakeTimers();
    try {
      render(
        <ContentState {...base} loading>
          rows
        </ContentState>,
      );
      expect(screen.queryByText("skeleton")).toBeNull();
      act(() => {
        jest.advanceTimersByTime(SKELETON_DELAY_MS);
      });
      expect(screen.getByText("skeleton")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows a failure with its reason and a retry, not the empty state", () => {
    const onRetry = jest.fn();
    render(
      <ContentState {...base} empty error="Server said no" onRetry={onRetry}>
        rows
      </ContentState>,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't load suites",
    );
    expect(screen.getByRole("alert").textContent).toContain("Server said no");
    expect(screen.queryByText("No suites yet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("tells no results from nothing yet", () => {
    const onClearFilters = jest.fn();
    const { rerender } = render(
      <ContentState {...base} empty>
        rows
      </ContentState>,
    );
    expect(screen.getByText("No suites yet")).toBeTruthy();
    rerender(
      <ContentState {...base} empty filtered onClearFilters={onClearFilters}>
        rows
      </ContentState>,
    );
    expect(screen.queryByText("No suites yet")).toBeNull();
    expect(screen.getByText("No results")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("renders the content once there is some", () => {
    render(<ContentState {...base}>rows</ContentState>);
    expect(screen.getByText("rows")).toBeTruthy();
  });
});

describe("SearchField", () => {
  it("takes focus on `/` in the shell unless the reader is typing elsewhere", () => {
    render(
      <ShortcutsProvider>
        <SearchField label="Filter suites" value="" onChange={() => {}} />
        <input aria-label="Other" />
      </ShortcutsProvider>,
    );
    const search = screen.getByRole("searchbox", { name: "Filter suites" });
    const other = screen.getByRole("textbox", { name: "Other" });

    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);

    other.blur();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(search);
  });
});

describe("BulkBar", () => {
  it("is absent with nothing selected and clears on Escape", () => {
    const onClear = jest.fn();
    const { rerender } = render(
      <BulkBar count={0} onClear={onClear}>
        actions
      </BulkBar>,
    );
    expect(
      screen.queryByRole("group", { name: "Actions on selected rows" }),
    ).toBeNull();
    rerender(
      <BulkBar count={2} onClear={onClear}>
        actions
      </BulkBar>,
    );
    expect(
      screen.getByRole("group", { name: "Actions on selected rows" })
        .textContent,
    ).toContain("2 selected");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("Field", () => {
  it("ties the label, help and error to the control", () => {
    render(
      <Field
        label="Name"
        mark="optional"
        help="Shown to staff only."
        error="Enter a name"
      >
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Name (optional)" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const described = (input.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["Shown to staff only.", "Enter a name"]);
  });
});

describe("SaveBar", () => {
  it("reports a failed save with its reason and keeps Save enabled", () => {
    render(
      <SaveBar
        state={SaveState.Failed}
        error="Name is taken"
        onSave={() => {}}
        onDiscard={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't save: Name is taken",
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save changes" })
        .disabled,
    ).toBe(false);
  });
});
