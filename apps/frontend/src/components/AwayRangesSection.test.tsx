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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  setSystemTime,
} from "bun:test";
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
let loads = 0;
let patches: unknown[] = [];
let deletes: string[] = [];
let deleteResponse = () => new Response(null, { status: 200 });
afterEach(() => {
  shown = [range];
  loads = 0;
  patches = [];
  deletes = [];
  deleteResponse = () => new Response(null, { status: 200 });
});

serveApi(
  routes({
    "GET /user/awayranges": () => {
      loads++;
      return Response.json(shown);
    },
    "DELETE /user/awayranges/:id": ({ params }) => {
      deletes.push(params.id);
      return deleteResponse();
    },
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

const removeButton = (container: HTMLElement) => {
  const button = container.querySelector(".lucide-x")?.closest("button");
  if (!button) throw new Error("no remove button");
  return button;
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

  it("offers no delete and fixes both dates once it has ended but saves a new note", async () => {
    shown = [locked(hoursFromNow(-96), hoursFromNow(-48))];
    const { container, pencil } = await renderList();

    expect(container.querySelector(".lucide-x")).toBeNull();
    fireEvent.click(pencil);
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

describe("removing a range", () => {
  const prompts: string[] = [];
  let answer = false;
  beforeEach(() => {
    prompts.length = 0;
    jest.spyOn(globalThis, "confirm").mockImplementation((message) => {
      prompts.push(String(message));
      return answer;
    });
  });

  it("deletes a range whose start has not locked without asking", async () => {
    const { container } = await renderList();

    fireEvent.click(removeButton(container));

    await waitFor(() => expect(deletes).toEqual(["1"]));
    expect(prompts).toEqual([]);
  });

  it("deletes a range that ended within its undo hour", async () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    shown = [
      {
        ...range,
        startDate: createdAt,
        endDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        createdAt,
      },
    ];
    const { container } = await renderList();

    fireEvent.click(removeButton(container));

    await waitFor(() => expect(deletes).toEqual(["1"]));
    expect(prompts).toEqual([]);
  });

  it("asks before ending a range whose start locked after it rendered", async () => {
    const start = Date.now() + 60 * 60 * 1000;
    shown = [
      {
        ...range,
        startDate: new Date(start).toISOString(),
        endDate: new Date(start + 48 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(start - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { container } = await renderList();

    setSystemTime(new Date(start + 60 * 1000));
    try {
      answer = false;
      fireEvent.click(removeButton(container));
    } finally {
      setSystemTime();
    }

    expect(prompts).toEqual(["End this away period now?"]);
    expect(deletes).toEqual([]);
  });

  it("asks before ending a range whose start has locked", async () => {
    const now = Date.now();
    shown = [
      {
        ...range,
        startDate: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    const { container } = await renderList();

    answer = false;
    fireEvent.click(removeButton(container));
    expect(prompts).toEqual(["End this away period now?"]);
    expect(deletes).toEqual([]);

    answer = true;
    fireEvent.click(removeButton(container));
    await waitFor(() => expect(deletes).toEqual(["1"]));
  });
});

describe("a failed removal", () => {
  const alerts: string[] = [];
  beforeEach(() => {
    alerts.length = 0;
    jest.spyOn(globalThis, "alert").mockImplementation((message) => {
      alerts.push(String(message));
    });
  });

  const removeAndRead = async () => {
    const { container } = await renderList();
    fireEvent.click(removeButton(container));
    await waitFor(() => expect(alerts).toHaveLength(1));
    return alerts[0];
  };

  it("shows the server's reason for a refusal", async () => {
    deleteResponse = () =>
      Response.json(
        {
          statusCode: 400,
          message: "An away period that has ended can't be deleted.",
        },
        { status: 400 },
      );

    expect(await removeAndRead()).toBe(
      "An away period that has ended can't be deleted.",
    );
    await waitFor(() => expect(loads).toBe(2));
  });

  it("shows its own copy for a server failure", async () => {
    deleteResponse = () =>
      Response.json(
        { statusCode: 500, message: "Internal server error" },
        { status: 500 },
      );

    expect(await removeAndRead()).toBe(
      "There was an error deleting your away period. Please try again.",
    );
  });
});
