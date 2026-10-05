import { UserAwayRangeDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AwayRangesSection from "./AwayRangesSection";

afterEach(cleanup);

const range: UserAwayRangeDto = {
  id: 1,
  startDate: "2030-01-10T08:00:00.000Z",
  endDate: "2030-01-13T07:59:00.000Z",
  reason: "vacation",
  note: null,
  createdAt: "2029-12-01T00:00:00.000Z",
};

let shown = [range];
let patches: unknown[] = [];
afterEach(() => {
  shown = [range];
  patches = [];
});

serveApi(
  routes({
    "GET /user/awayranges": () => Response.json(shown),
    "PATCH /user/awayranges/:id": async ({ request }) => {
      patches.push(await request.json());
      return Response.json(range);
    },
  }),
);

const renderList = async () => {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <AwayRangesSection />
    </QueryClientProvider>,
  );
  const pencil = await waitFor(() => {
    const found = container.querySelector(".lucide-pencil")?.closest("button");
    if (!found) throw new Error("no edit button");
    return found;
  });
  return { container, pencil };
};

const openEditor = async () => {
  const { container, pencil } = await renderList();
  fireEvent.click(pencil);
  return container;
};

const today = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

const dateInput = (container: HTMLElement, name: string) => {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${name}"]`,
  );
  if (!input) throw new Error(`no ${name} input`);
  return input;
};

const save = async () => {
  fireEvent.click(screen.getByText("Save"));
  await waitFor(() => expect(patches).toHaveLength(1));
  return patches[0];
};

it("leaves untouched days out of the request", async () => {
  await openEditor();

  expect(await save()).toEqual({ reason: "vacation", note: null });
});

it("sends only the day the member changed", async () => {
  const container = await openEditor();
  fireEvent.change(dateInput(container, "editStartDate"), {
    target: { value: "2030-01-05" },
  });

  expect(await save()).toEqual({
    startDay: "2030-01-05",
    reason: "vacation",
    note: null,
  });
});

describe("a range whose start has locked", () => {
  const hoursFromNow = (hours: number) =>
    new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const locked = (startDate: string, endDate: string): UserAwayRangeDto => ({
    ...range,
    startDate,
    endDate,
    createdAt: hoursFromNow(-24 * 30),
  });

  it("keeps an ongoing range's start fixed and its end from today on", async () => {
    shown = [locked(hoursFromNow(-48), hoursFromNow(48))];
    const container = await openEditor();

    expect(dateInput(container, "editStartDate").disabled).toBe(true);
    const end = dateInput(container, "editEndDate");
    expect(end.disabled).toBe(false);
    expect(end.min).toBe(today());
    screen.getByText("Days that have already begun can't be changed.");
  });

  it("fixes both dates once it has ended but saves a new note", async () => {
    shown = [locked(hoursFromNow(-96), hoursFromNow(-48))];
    const container = await openEditor();

    expect(dateInput(container, "editStartDate").disabled).toBe(true);
    expect(dateInput(container, "editEndDate").disabled).toBe(true);
    const note = container.querySelector<HTMLInputElement>(
      'input[name="editNote"]',
    );
    if (!note) throw new Error("no note input");
    fireEvent.change(note, { target: { value: "back home" } });
    expect(await save()).toEqual({ reason: "vacation", note: "back home" });
  });
});

it("offers start days from today on for a range that has not begun", async () => {
  const container = await openEditor();

  const start = dateInput(container, "editStartDate");
  expect(start.disabled).toBe(false);
  expect(start.min).toBe(today());
  expect(
    screen.queryByText("Days that have already begun can't be changed."),
  ).toBeNull();
});

it("leaves both dates editable for a range that ended within its undo hour", async () => {
  const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  shown = [
    {
      ...range,
      startDate: createdAt,
      endDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      createdAt,
    },
  ];
  const container = await openEditor();

  expect(dateInput(container, "editStartDate").disabled).toBe(false);
  expect(dateInput(container, "editEndDate").disabled).toBe(false);
});
