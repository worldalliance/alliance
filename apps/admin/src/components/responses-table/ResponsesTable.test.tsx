import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import ResponsesTable from "./ResponsesTable";

afterEach(() => {
  localStorage.clear();
});

const SCHEMA: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "people",
          type: "input",
          kind: "list",
          label: "Who else?",
          fields: [{ id: "who", type: "input", kind: "text", label: "Name" }],
        },
        { id: "why", type: "input", kind: "textarea", label: "Why join?" },
      ],
    },
  ],
  outputViews: [],
};

const response = (params: {
  id: number;
  why: string;
  createdAt: string;
  people?: Array<{ who: string }>;
}) =>
  makeFormResponse({
    id: params.id,
    createdAt: params.createdAt,
    formId: 3,
    formSnapshotId: 7,
    answers: { why: params.why, people: params.people },
    schemaSnapshot: SCHEMA,
  });

const RESPONSES = [
  response({
    id: 1,
    why: "zebra",
    createdAt: "2026-03-02T10:00:00.000Z",
    people: [{ who: "Ada" }, { who: "Bo" }],
  }),
  response({ id: 2, why: "apple", createdAt: "2026-03-03T10:00:00.000Z" }),
  response({
    id: 3,
    why: "first line\nsecond line",
    createdAt: "2026-03-01T10:00:00.000Z",
  }),
];

const RETIRED_RESPONSE = makeFormResponse({
  id: 4,
  formId: 3,
  formSnapshotId: 6,
  answers: { old: "yes" },
  schemaSnapshot: {
    pages: [
      {
        id: "page-1",
        fields: [
          { id: "why", type: "input", kind: "textarea", label: "Why?" },
          { id: "old", type: "input", kind: "textarea", label: "Old" },
        ],
      },
    ],
    outputViews: [],
  },
});

serveApi(
  routes({
    "GET /tasks/forms/:formId/snapshotMigration": () =>
      Response.json({
        formTitle: "Survey",
        latestSnapshot: {
          id: 7,
          hash: "hash-7",
          createdAt: "2026-03-15T12:00:00.000Z",
          schema: { pages: [], outputViews: [] },
        },
        groups: [],
      }),
  }),
);

const ParamsProbe = () => {
  const [params] = useSearchParams();
  return <output data-testid="params">{params.toString()}</output>;
};

const currentParams = () =>
  new URLSearchParams(screen.getByTestId("params").textContent ?? "");

const renderTable = (search = "", responses = RESPONSES) =>
  render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SiteOriginLinkProvider origin="https://worldalliance.org">
        <ToastProvider>
          <ResponsesTable
            form={{ id: 3, title: "Survey", formSnapshotId: 7, schema: SCHEMA }}
            responses={responses}
            withdrawnUserMap={new Map()}
            sidsToUserMap={{}}
            loading={false}
            error={null}
            paramKey={(name) => `r_${name}`}
          />
          <ParamsProbe />
        </ToastProvider>
      </SiteOriginLinkProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const tableRows = () => within(screen.getByRole("table")).getAllByRole("row");

const answerOrder = () =>
  tableRows()
    .slice(1)
    .map((row) => within(row).getAllByRole("cell").at(-1)?.textContent);

it("opens a response when its row is clicked", () => {
  renderTable();

  const [zebra, apple] = document.querySelectorAll("tbody tr");

  fireEvent.click(screen.getByText("apple"));

  expect(currentParams().get("r_response")).toBe("2");
  expect(apple.className).toContain("bg-blue-50");
  expect(zebra.className).not.toContain("bg-blue-50");
  expect(screen.getByRole("button", { name: "Next response" })).toBeTruthy();
});

it("expands a row from its chevron without opening it, and collapses it again", () => {
  renderTable();
  const row = tableRows()[1];
  expect(within(row).getByText("Ada (+1 other)")).toBeTruthy();

  fireEvent.click(within(row).getByRole("button", { name: "Expand row" }));

  expect(within(row).getByText("1. Ada 2. Bo")).toBeTruthy();
  expect(currentParams().get("r_response")).toBeNull();

  fireEvent.click(within(row).getByRole("button", { name: "Collapse row" }));

  expect(within(row).getByText("Ada (+1 other)")).toBeTruthy();
});

it("expands a row when a clipped cell is clicked, without opening it", () => {
  renderTable();
  const row = tableRows()[3];

  fireEvent.click(within(row).getByText(/first line/));

  expect(
    within(row).getByRole("button", { name: "Collapse row" }),
  ).toBeTruthy();
  expect(currentParams().get("r_response")).toBeNull();
});

it("expands a row when a long one-line cell is clicked, without opening it", () => {
  const long = "x".repeat(49);
  renderTable("", [
    ...RESPONSES,
    response({ id: 5, why: long, createdAt: "2026-03-04T10:00:00.000Z" }),
  ]);
  const row = tableRows()[4];

  fireEvent.click(within(row).getByText(long));

  expect(
    within(row).getByRole("button", { name: "Collapse row" }),
  ).toBeTruthy();
  expect(currentParams().get("r_response")).toBeNull();
});

it("shows a dash for an unanswered question", () => {
  renderTable();

  const [people] = within(tableRows()[2]).getAllByRole("cell").slice(-2);
  expect(people.textContent).toBe("—");
});

it("sorts by a column when its header is clicked", () => {
  renderTable();

  fireEvent.click(screen.getByRole("button", { name: "Submitted" }));

  expect(currentParams().get("r_sort")).toBe("submitted:asc");
  expect(answerOrder()).toEqual(["first line\nsecond line", "zebra", "apple"]);
  expect(document.querySelector("th .lucide-arrow-up")).not.toBeNull();
  expect(document.querySelector("th .lucide-arrow-down")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Submitted" }));

  expect(currentParams().get("r_sort")).toBe("submitted:desc");
  expect(answerOrder()).toEqual(["apple", "zebra", "first line\nsecond line"]);
  expect(document.querySelector("th .lucide-arrow-up")).toBeNull();
  expect(document.querySelector("th .lucide-arrow-down")).not.toBeNull();
});

it("says so when a search matches no response", () => {
  renderTable("?r_q=nothing");

  expect(screen.getByText("No response matches this search.")).toBeTruthy();
});

it("says so when the form has no responses", () => {
  renderTable("", []);

  expect(screen.getByText("No responses yet for this form.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("highlights the search query in matching cells", () => {
  renderTable("?r_q=zeb");

  expect(tableRows()).toHaveLength(2);
  expect(screen.getByText("zeb").tagName).toBe("MARK");
});

it("writes the search to the URL after the keystroke, not during it", async () => {
  renderTable();

  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search responses" }),
    {
      target: { value: "apple" },
    },
  );

  expect(currentParams().get("r_q")).toBeNull();
  await waitFor(() => expect(currentParams().get("r_q")).toBe("apple"));
  expect(tableRows()).toHaveLength(2);
});

it("counts the responses a search leaves", () => {
  renderTable("?r_q=zeb");

  expect(screen.getByText("1 response of 3")).toBeTruthy();
});

it("expands every row from Expand rows, and collapses them again", () => {
  renderTable();

  fireEvent.click(screen.getByRole("button", { name: "Expand rows" }));

  expect(screen.getAllByRole("button", { name: "Collapse row" })).toHaveLength(
    3,
  );
  expect(screen.getByText("1. Ada 2. Bo")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Expand rows" }));

  expect(screen.getAllByRole("button", { name: "Expand row" })).toHaveLength(3);
  expect(screen.getByText("Ada (+1 other)")).toBeTruthy();
});

it("switches between every version's questions and the current version's", () => {
  renderTable("", [...RESPONSES, RETIRED_RESPONSE]);
  expect(screen.getByRole("button", { name: "Old" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "All versions" }));

  expect(screen.getByRole("button", { name: "Current version" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Old" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Current version" }));

  expect(screen.getByRole("button", { name: "Old" })).toBeTruthy();
});

it("hides a column from the column menu", () => {
  renderTable();

  fireEvent.click(screen.getByRole("button", { name: /^Columns/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Submitted" }));

  expect(screen.queryByRole("button", { name: "Submitted" })).toBeNull();
});

it("opens the versions drawer", () => {
  renderTable();

  fireEvent.click(screen.getByRole("button", { name: /^Versions/ }));

  expect(screen.getByRole("dialog", { name: "Versions" })).toBeTruthy();
});

it("copies a link to the view that carries its hidden columns", async () => {
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  renderTable();
  fireEvent.click(screen.getByRole("button", { name: /^Columns/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Submitted" }));

  fireEvent.click(screen.getByRole("button", { name: "Copy view link" }));

  expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  const link = new URL(String(writeText.mock.lastCall?.[0]));
  expect(link.searchParams.get("r_hidden")).toBe("responseId,userId,submitted");
});

it("says so when the view link cannot be copied", async () => {
  jest
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValue(new DOMException("denied"));
  renderTable();

  fireEvent.click(screen.getByRole("button", { name: "Copy view link" }));

  expect(
    await screen.findByText("Could not copy the view link to the clipboard"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy view link" })).toBeTruthy();
});

it("narrows the rows to a version until its filter is cleared", () => {
  renderTable("?r_version=6", [...RESPONSES, RETIRED_RESPONSE]);
  expect(tableRows()).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Clear version filter" }));

  expect(currentParams().get("r_version")).toBeNull();
  expect(tableRows()).toHaveLength(5);
});

it("titles a header with a question's retirement and wording history", () => {
  renderTable("", [...RESPONSES, RETIRED_RESPONSE]);

  expect(screen.getByRole("button", { name: /^Why join\?/ }).title).toBe(
    "why\nWording by version:\nv6: Why?\nv7: Why join?",
  );
  expect(
    screen.getByLabelText("Wording changed between versions"),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Old" }).title).toBe(
    "old\nRetired, last in v6",
  );
});
