import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "bun:test";
import { MemoryRouter, useLocation } from "react-router";
import { CountId, PlaceId, RecordId } from "../../places";
import { ModalFooter } from "../Modal";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../Table";
import { FieldGroup, SaveBar, SaveState } from "./Form";
import { listCount, useListSearch } from "./List";
import { DateRangeFields, Panel, Section } from "./Overview";
import { Page } from "./Page";
import { ContentState, RefreshFailedBanner } from "./States";
import { usePlaceTabs, withQueueCounts } from "./usePlaceTabs";

afterEach(cleanup);

const query = (
  over: Partial<Parameters<typeof RefreshFailedBanner>[0]["query"]> = {},
) => ({
  isRefetchError: true,
  isFetching: false,
  error: new Error("x"),
  refetch: jest.fn(),
  ...over,
});

describe("RefreshFailedBanner", () => {
  it("says the content is stale and retries", () => {
    const failed = query();
    render(<RefreshFailedBanner things="groups" query={failed} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't refresh groups.",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Showing what loaded before.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it("renders nothing unless a refetch failed", () => {
    const { container } = render(
      <RefreshFailedBanner
        things="groups"
        query={query({ isRefetchError: false })}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("ContentState retry", () => {
  it("shows the retry as busy while it runs", () => {
    render(
      <ContentState
        loading={false}
        skeleton={null}
        error="Server said no"
        errorTitle="Couldn't load groups"
        onRetry={() => {}}
        retrying
      >
        rows
      </ContentState>,
    );
    expect(
      screen
        .getByRole("button", { name: "Try again" })
        .getAttribute("aria-busy"),
    ).toBe("true");
  });
});

describe("listCount", () => {
  it("says nothing until there is something to count", () => {
    expect(listCount({ shown: 0, total: undefined, noun: "group" })).toBe(
      undefined,
    );
    expect(listCount({ shown: 0, total: 0, noun: "group" })).toBe(undefined);
  });

  it("counts all, or the shown part of all", () => {
    expect(listCount({ shown: 1200, total: 1200, noun: "group" })).toBe(
      "1,200 groups",
    );
    expect(listCount({ shown: 1, total: 1200, noun: "group" })).toBe(
      "1 of 1,200 groups",
    );
  });
});

function Search() {
  const [q, setQ] = useListSearch();
  const { search } = useLocation();
  return (
    <>
      <button type="button" onClick={() => setQ(q ? "" : "north")}>
        toggle
      </button>
      <output>{search}</output>
    </>
  );
}

describe("useListSearch", () => {
  it("keeps the search in ?q= beside the other params", () => {
    render(
      <MemoryRouter initialEntries={["/members/groups?tab=awaiting"]}>
        <Search />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByRole("status").textContent).toBe(
      "?tab=awaiting&q=north",
    );
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByRole("status").textContent).toBe("?tab=awaiting");
  });
});

describe("Table pieces", () => {
  it("names the actions column for screen readers and labels a group row", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead actions>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableGroupRow colSpan={2} label="Active" count={1200} />
          <TableRow>
            <TableCell truncate>A long description</TableCell>
            <TableCell actions>
              <button type="button">Remove</button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeTruthy();
    expect(
      screen.getByRole("rowheader", { name: "Active 1,200" }),
    ).toBeTruthy();
    expect(screen.getByText("A long description").getAttribute("title")).toBe(
      "A long description",
    );
  });

  it("expands a row into its detail", () => {
    const { rerender } = render(
      <ExpandToggle expanded={false} controls="d" onToggle={() => {}}>
        12 members
      </ExpandToggle>,
    );
    expect(
      screen
        .getByRole("button", { name: "12 members" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    rerender(
      <table>
        <tbody>
          <tr>
            <td>
              <ExpandToggle expanded controls="d" onToggle={() => {}}>
                12 members
              </ExpandToggle>
            </td>
          </tr>
          <TableDetailRow id="d" colSpan={1}>
            Sam Lee
          </TableDetailRow>
        </tbody>
      </table>,
    );
    const toggle = screen.getByRole("button", { name: "12 members" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      document.getElementById(toggle.getAttribute("aria-controls") ?? "")
        ?.textContent,
    ).toBe("Sam Lee");
  });
});

describe("SaveBar words", () => {
  it("says what a bar that uploads is doing", () => {
    render(
      <SaveBar
        state={SaveState.Failed}
        error="Too large"
        saveLabel="Upload"
        stateText={{ [SaveState.Failed]: "Couldn't upload" }}
        onSave={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't upload: Too large",
    );
  });
});

describe("FieldGroup", () => {
  it("names the group by its legend, ties its help and error to it, and disables it whole", () => {
    render(
      <FieldGroup
        label="Audience"
        help="Who sees it."
        error="Pick one"
        disabled
      >
        <input type="checkbox" aria-label="Members" />
      </FieldGroup>,
    );
    const group = screen.getByRole("group", { name: "Audience" });
    const described = (group.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(["Who sees it.", "Pick one"]);
    expect(group.hasAttribute("disabled")).toBe(true);
  });
});

describe("Panel heading", () => {
  it("is an h2 on its own and an h3 under a Section", () => {
    render(
      <>
        <Panel title="Members">x</Panel>
        <Section title="Stats">
          <Panel title="Signups">y</Panel>
        </Section>
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Members", level: 2 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Signups", level: 3 }),
    ).toBeTruthy();
  });
});

describe("ModalFooter error", () => {
  it("shows a refusal above the buttons", () => {
    render(
      <ModalFooter error="That name is taken">
        <button type="button">Create group</button>
      </ModalFooter>,
    );
    expect(screen.getByRole("alert").textContent).toBe("That name is taken");
  });
});

function GroupsTabs({ count }: { count: number | null | undefined }) {
  const tabs = usePlaceTabs(PlaceId.Groups, ["all", "awaiting"]);
  return (
    <Page
      place={PlaceId.Groups}
      tabs={withQueueCounts(tabs, { [CountId.AwaitingGroup]: count })}
    >
      body
    </Page>
  );
}

describe("withQueueCounts", () => {
  const tabText = (count: number | null | undefined) => {
    render(
      <MemoryRouter>
        <GroupsTabs count={count} />
      </MemoryRouter>,
    );
    const text = screen.getByRole("tab", {
      name: /Awaiting assignment/,
    }).textContent;
    cleanup();
    return text;
  };

  it("puts the queue's size on the tab places.ts names, as the sidebar does", () => {
    expect(tabText(1200)).toBe("Awaiting assignment1,200");
    expect(tabText(null)).toBe("Awaiting assignment!(count couldn't load)");
    expect(tabText(0)).toBe("Awaiting assignment");
    expect(tabText(undefined)).toBe("Awaiting assignment");
  });
});

describe("Page for a record under a later tab", () => {
  it("puts that tab in the breadcrumb", () => {
    render(
      <MemoryRouter>
        <Page record={RecordId.Video} title="Intro">
          body
        </Page>
      </MemoryRouter>,
    );
    const links = [
      ...screen
        .getByRole("navigation", { name: "Breadcrumb" })
        .querySelectorAll("a"),
    ].map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links.at(-1)).toEqual(["Videos", "/content/media?tab=videos"]);
  });
});

describe("Overview controls", () => {
  it("changes only the edited end of a date range, and ties its error to the start", () => {
    const onChange = jest.fn();
    render(
      <DateRangeFields
        range={{ start: "2026-01-01", end: "2026-02-01" }}
        onChange={onChange}
        error="Choose a start date on or before the end date"
      />,
    );
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-03-01" },
    });
    expect(onChange).toHaveBeenCalledWith({
      start: "2026-01-01",
      end: "2026-03-01",
    });
    expect(screen.getByLabelText("From").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(screen.getByLabelText("To").getAttribute("aria-invalid")).toBeNull();
  });
});
