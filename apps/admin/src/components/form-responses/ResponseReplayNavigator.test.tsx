import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ResponseReplayNavigator from "./ResponseReplayNavigator";
import {
  useRespondentSearch,
  type RespondentSearch,
} from "./useRespondentSearch";

afterEach(cleanup);

const response = makeFormResponse({
  id: 4,
  sessionReplayUrl: "https://example.test/recordings/abc123",
});

const search = (
  overrides: Partial<RespondentSearch> = {},
): RespondentSearch => ({
  query: "",
  setQuery: jest.fn(),
  open: false,
  setOpen: jest.fn(),
  containerRef: { current: null },
  results: [],
  select: jest.fn(),
  handleKeyDown: jest.fn(),
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

const WithSearch = () => (
  <Navigator
    respondentSearch={useRespondentSearch({
      responses: [response],
      getRespondentName: () => "Ana",
      onSelect: () => {},
    })}
  />
);

it("shows the filter, the current respondent and their session replay", () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null);
  renderNavigator(search());

  expect(screen.getByText("(1 of 3)")).toBeTruthy();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.getByText("Short")).toBeTruthy();
  fireEvent.click(screen.getByText("Replay"));
  expect(open).toHaveBeenCalledWith(
    "https://us.posthog.com/project/188181/replay/home?sessionRecordingId=abc123",
    "_blank",
  );
  open.mockRestore();
});

it("lists search results and selects the one clicked", () => {
  const respondentSearch = search({
    open: true,
    results: [{ response, idx: 0, name: "Ana Search" }],
  });
  renderNavigator(respondentSearch);
  fireEvent.click(screen.getByText("Ana Search"));

  expect(respondentSearch.select).toHaveBeenCalledWith(0);
});

it("says when no response matches the search", () => {
  renderNavigator(search({ open: true }));

  expect(screen.getByText("No matching responses")).toBeTruthy();
});

it("opens the results as the search is typed and closes them on a click outside", () => {
  render(<WithSearch />);
  fireEvent.change(screen.getByPlaceholderText("Search by name..."), {
    target: { value: "an" },
  });
  expect(screen.getAllByText("Ana")).toHaveLength(2);

  fireEvent.mouseDown(document.body);
  expect(screen.getAllByText("Ana")).toHaveLength(1);
});
