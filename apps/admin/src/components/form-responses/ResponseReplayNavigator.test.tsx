import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ResponseReplayNavigator from "./ResponseReplayNavigator";
import {
  RESPONDENT_RESULT_LIMIT,
  useRespondentSearch,
  type RespondentSearch,
} from "./useRespondentSearch";

const response = makeFormResponse({
  id: 4,
  sessionReplayUrl: "https://example.test/recordings/abc123",
});

const search = (
  overrides: Partial<RespondentSearch> = {},
): RespondentSearch => ({
  query: "",
  setQuery: jest.fn(),
  results: [],
  select: jest.fn(),
  ...overrides,
});

const Navigator = ({
  respondentSearch,
}: {
  respondentSearch: RespondentSearch;
}) => (
  <ResponseReplayNavigator
    filterSummary={{ fieldLabel: "Agree", description: "Checked" }}
    filteredTotal={1}
    total={3}
    onClearFilter={() => {}}
    page={1}
    onPageChange={() => {}}
    search={respondentSearch}
    currentResponse={response}
    getRespondentName={() => "Ana"}
    getResponseVariantName={() => "Short"}
    withdrawnUserMap={new Map()}
  />
);

const renderNavigator = (respondentSearch: RespondentSearch) =>
  render(<Navigator respondentSearch={respondentSearch} />);

it("shows the filter, the current respondent and their session replay", () => {
  renderNavigator(search());

  expect(screen.getByText("1 of 3 responses")).toBeTruthy();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.getByText("Short")).toBeTruthy();
  const recording = screen.getByRole("link", {
    name: /Watch session recording/,
  });
  expect(recording.getAttribute("href")).toBe(
    "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=abc123",
  );
  expect(recording.getAttribute("rel")).toBe("noopener noreferrer");
});

const openList = () => {
  const box = screen.getByRole("combobox", { name: "Find a respondent" });
  fireEvent.keyDown(box, { key: "ArrowDown" });
  return box;
};

it("lists search results, marks the one showing and selects the one clicked", async () => {
  const respondentSearch = search({
    results: [
      { response, idx: 0, name: "Ana Search" },
      { response, idx: 1, name: "Ben Search" },
    ],
  });
  renderNavigator(respondentSearch);
  openList();
  await waitFor(() => expect(screen.getAllByRole("option").length).toBe(2));
  expect(screen.getAllByRole("option")[0]?.textContent).toContain("Showing");
  expect(screen.getAllByRole("option")[1]?.textContent).not.toContain(
    "Showing",
  );
  fireEvent.click(screen.getByText("Ben Search"));

  expect(respondentSearch.select).toHaveBeenCalledWith(1);
});

it("selects the highlighted result with the keyboard", async () => {
  const respondentSearch = search({
    results: [
      { response, idx: 0, name: "Ana Search" },
      { response, idx: 1, name: "Ben Search" },
    ],
  });
  renderNavigator(respondentSearch);
  const box = openList();
  await waitFor(() => expect(screen.getAllByRole("option").length).toBe(2));
  fireEvent.keyDown(box, { key: "ArrowDown" });
  fireEvent.keyDown(box, { key: "Enter" });

  expect(respondentSearch.select).toHaveBeenCalledWith(1);
});

it("says when no response matches the search", async () => {
  renderNavigator(search());
  openList();

  await waitFor(() =>
    expect(screen.getByText("No matching responses")).toBeTruthy(),
  );
});

it("shows only the first results and says how many more there are", async () => {
  const results = Array.from(
    { length: RESPONDENT_RESULT_LIMIT + 3 },
    (_, idx) => ({ response, idx, name: `Person ${idx}` }),
  );
  renderNavigator(search({ results }));
  openList();

  await waitFor(() =>
    expect(screen.getAllByRole("option").length).toBe(
      RESPONDENT_RESULT_LIMIT + 1,
    ),
  );
  expect(
    screen.getByText("3 more. Type a name to narrow the list."),
  ).toBeTruthy();
});

it("passes what is typed to the search", () => {
  const setQuery = jest.fn();
  renderNavigator(search({ setQuery }));
  const box = openList();
  fireEvent.input(box, { target: { value: "an" } });

  expect(setQuery.mock.calls[0]?.[0]).toBe("an");
});

it("picks a typed match and clears the box", async () => {
  const onSelect = jest.fn();
  const WithSearch = () => (
    <Navigator
      respondentSearch={useRespondentSearch({
        responses: [response],
        getRespondentName: () => "Ana",
        onSelect,
      })}
    />
  );
  render(<WithSearch />);
  const box = openList();
  fireEvent.input(box, { target: { value: "an" } });
  await waitFor(() => expect(screen.getAllByRole("option").length).toBe(1));
  fireEvent.keyDown(box, { key: "Enter" });

  expect(onSelect).toHaveBeenCalledWith(0);
  await waitFor(() => expect((box as HTMLInputElement).value).toBe(""));
});
