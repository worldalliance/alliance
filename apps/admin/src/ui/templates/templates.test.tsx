import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, jest, spyOn } from "bun:test";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { PlaceId, RecordId } from "../../places";
import { ShortcutsProvider } from "../../shell/shortcuts";
import { Input } from "../Input";
import {
  CheckboxField,
  Field,
  SaveBar,
  SaveState,
  useFocusFirstInvalid,
} from "./Form";
import { BulkBar, SearchField, ViewSwitch } from "./List";
import { Page } from "./Page";
import { ContentState } from "./States";
import { SKELETON_DELAY_MS } from "./useDelayedFlag";
import { usePlaceTabs, usePlaceViews, useRecordTabs } from "./usePlaceTabs";

afterEach(cleanup);

function GroupsPage({ ids = ["all", "awaiting"] }: { ids?: string[] }) {
  const tabs = usePlaceTabs(PlaceId.Groups, ids);
  const { search } = useLocation();
  return (
    <Page
      place={PlaceId.Groups}
      tabs={{
        ...tabs,
        items: tabs.items.map((tab) =>
          tab.id === "awaiting" ? { ...tab, count: 1200 } : tab,
        ),
      }}
    >
      <p>Body of {tabs.value}</p>
      <output>{search}</output>
    </Page>
  );
}

const renderAt = (url: string, page = <GroupsPage />) =>
  render(<MemoryRouter initialEntries={[url]}>{page}</MemoryRouter>);

const breadcrumbLinks = () =>
  [
    ...screen
      .getByRole("navigation", { name: "Breadcrumb" })
      .querySelectorAll("a"),
  ].map((link) => link.getAttribute("href"));

describe("Page with a place's tabs", () => {
  it("opens the first tab on the bare URL, labelled from the page map", () => {
    renderAt("/members/groups");
    expect(
      screen.getByRole("tab", { name: "All groups", selected: true }),
    ).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain("Body of all");
  });

  it("opens the tab the URL names", () => {
    renderAt("/members/groups?tab=awaiting");
    expect(
      screen.getByRole("tab", {
        name: "Awaiting assignment 1,200",
        selected: true,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain(
      "Body of awaiting",
    );
  });

  it("falls back to the first tab on an unknown value", () => {
    renderAt("/members/groups?tab=nope");
    expect(
      screen.getByRole("tab", { name: "All groups", selected: true }),
    ).toBeTruthy();
  });

  it("writes the chosen tab to the URL, keeping the view and dropping the tab's own params, and clears it for the first", () => {
    renderAt("/members/groups?q=heat&view=map");
    fireEvent.click(
      screen.getByRole("tab", { name: "Awaiting assignment 1,200" }),
    );
    expect(screen.getByRole("status").textContent).toBe(
      "?view=map&tab=awaiting",
    );
    fireEvent.click(screen.getByRole("tab", { name: "All groups" }));
    expect(screen.getByRole("status").textContent).toBe("?view=map");
  });

  it("throws when the page's tab ids differ from the page map's", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() =>
        renderAt("/members/groups", <GroupsPage ids={["all", "waiting"]} />),
      ).toThrow(/places\.ts/);
    } finally {
      error.mockRestore();
    }
  });
});

describe("Page views", () => {
  function PeoplePage() {
    const views = usePlaceViews(PlaceId.People, ["table", "map"]);
    const { search } = useLocation();
    return (
      <Page place={PlaceId.People}>
        <ViewSwitch label="View" {...views} />
        <output>{search}</output>
      </Page>
    );
  }

  it("writes the view to the URL and keeps every other param", () => {
    renderAt("/members?tab=staff&q=lee", <PeoplePage />);
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    expect(screen.getByRole("status").textContent).toBe(
      "?tab=staff&q=lee&view=map",
    );
    expect(
      screen.getByRole("button", { name: "Map" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("Page header", () => {
  it("names a place's page from the page map: h1, breadcrumb and document title", () => {
    renderAt("/members/groups");
    expect(
      screen.getByRole("heading", { level: 1, name: "Groups" }),
    ).toBeTruthy();
    expect(breadcrumbLinks()).toEqual(["/members"]);
    expect(document.title).toBe("Groups - Admin");
  });

  it("puts a record under its place and its parents, titled by its name", () => {
    renderAt(
      "/tasks/suites/3",
      <Page
        record={RecordId.Suite}
        title="Winter push"
        parents={[{ label: "Heat and repairs", to: "/tasks/projects/2" }]}
      >
        body
      </Page>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Winter push" }),
    ).toBeTruthy();
    expect(breadcrumbLinks()).toEqual([
      "/tasks",
      "/tasks/suites",
      "/tasks/projects/2",
    ]);
    expect(document.title).toBe("Winter push - Admin");
  });

  it("says what a record is called until its name loads", () => {
    renderAt("/tasks/suites/3", <Page record={RecordId.Suite}>body</Page>);
    expect(
      screen.getByRole("heading", { level: 1, name: "Suite" }),
    ).toBeTruthy();
    expect(breadcrumbLinks()).toEqual(["/tasks", "/tasks/suites"]);
    expect(document.title).toBe("Suite - Admin");
  });

  it("gives an area's own page no breadcrumb", () => {
    renderAt("/tasks", <Page place={PlaceId.AllTasks}>body</Page>);
    expect(
      screen.getByRole("heading", { level: 1, name: "All tasks" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(document.title).toBe("All tasks - Admin");
  });
});

describe("Page with a record's tabs", () => {
  function FormPage({ ids }: { ids: string[] }) {
    const tabs = useRecordTabs(RecordId.Form, ids);
    return (
      <Page record={RecordId.Form} title="Intake" tabs={tabs}>
        <p>Body of {tabs.value}</p>
      </Page>
    );
  }

  it("labels them from the page map and opens the one the URL names", () => {
    renderAt(
      "/tasks/forms/3?tab=responses",
      <FormPage ids={["builder", "responses", "versions"]} />,
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Builder",
      "Responses",
      "Versions",
    ]);
    expect(screen.getByText("Body of responses")).toBeTruthy();
  });

  it("throws when the page's tab ids differ from the page map's", () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderAt("/tasks/forms/3", <FormPage ids={["builder"]} />),
    ).toThrow();
    spy.mockRestore();
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

describe("SearchField with a value that comes back late", () => {
  function LateSearch() {
    const [value, setValue] = useState("");
    return (
      <>
        <SearchField
          label="Filter groups"
          value={value}
          onChange={(next) => setTimeout(() => setValue(next), 5)}
        />
        <button type="button" onClick={() => setValue("")}>
          Clear filters
        </button>
        <output>{value}</output>
      </>
    );
  }

  it("keeps every letter typed before the value catches up", async () => {
    render(<LateSearch />);
    const search = screen.getByRole<HTMLInputElement>("searchbox");
    search.focus();

    fireEvent.change(search, { target: { value: "n" } });
    expect(search.value).toBe("n");
    fireEvent.change(search, { target: { value: "no" } });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("no"),
    );

    expect(search.value).toBe("no");
  });

  it("keeps the text when it is typed back to an earlier one on the way", () => {
    let setValue: (value: string) => void = () => {};
    const sent: string[] = [];
    function Echoed() {
      const [value, set] = useState("");
      setValue = set;
      return (
        <SearchField
          label="Filter groups"
          value={value}
          onChange={(next) => sent.push(next)}
        />
      );
    }
    render(<Echoed />);
    const search = screen.getByRole<HTMLInputElement>("searchbox");
    search.focus();

    for (const typed of ["a", "ab", "a"]) {
      fireEvent.change(search, { target: { value: typed } });
    }
    for (const echo of sent) {
      act(() => setValue(echo));
      expect(search.value).toBe("a");
    }
  });

  it("takes the value once the reader has left it, as Clear filters sets", async () => {
    render(<LateSearch />);
    const search = screen.getByRole<HTMLInputElement>("searchbox");
    search.focus();
    fireEvent.change(search, { target: { value: "no" } });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("no"),
    );

    const clear = screen.getByRole("button", { name: "Clear filters" });
    clear.focus();
    fireEvent.click(clear);

    expect(search.value).toBe("");
  });
});

describe("Page header's description", () => {
  it("holds its line when empty, so a record's facts landing move nothing", () => {
    renderAt(
      "/members/groups/4",
      <Page record={RecordId.Group} description="">
        <p>Body</p>
      </Page>,
    );
    expect(screen.getByRole("banner").lastElementChild?.className).toContain(
      "min-h-lh",
    );
  });
});

describe("CheckboxField", () => {
  it("names the checkbox by its label and describes it by its help", () => {
    render(
      <CheckboxField
        label="Let anyone join"
        help="No approval needed."
        checked
        onChange={() => {}}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "Let anyone join" });
    expect(
      document.getElementById(box.getAttribute("aria-describedby")!)
        ?.textContent,
    ).toBe("No approval needed.");
  });
});

describe("useFocusFirstInvalid", () => {
  function TwoFields() {
    const [errors, setErrors] = useState<{ name?: string; city?: string }>({});
    const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
    return (
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          setErrors({ city: "Enter a city." });
          focusFirstInvalid();
        }}
      >
        <Field label="Name" error={errors.name}>
          {(control) => (
            <Input
              {...control}
              onBlur={() => setErrors({ name: "Enter a name." })}
            />
          )}
        </Field>
        <Field label="City" error={errors.city}>
          {(control) => <Input {...control} />}
        </Field>
        <button type="submit">Save</button>
      </form>
    );
  }

  it("focuses the first invalid control on a failed submit, not on an error set on blur", () => {
    render(<TwoFields />);
    const name = screen.getByRole("textbox", { name: "Name" });
    const save = screen.getByRole("button", { name: "Save" });

    name.focus();
    act(() => save.focus());
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(save);

    fireEvent.click(save);
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "City" }),
    );
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
