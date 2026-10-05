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

let patches: unknown[] = [];
afterEach(() => {
  patches = [];
});

serveApi(
  routes({
    "GET /user/awayranges": () => Response.json([range]),
    "PATCH /user/awayranges/:id": async ({ request }) => {
      patches.push(await request.json());
      return Response.json(range);
    },
  }),
);

const openEditor = async () => {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <AwayRangesSection />
    </QueryClientProvider>,
  );
  await screen.findByText("Scheduled");
  const pencil = container.querySelector(".lucide-pencil")?.closest("button");
  if (!pencil) throw new Error("no edit button");
  fireEvent.click(pencil);
  return container;
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
  const start = container.querySelector('input[name="editStartDate"]');
  if (!start) throw new Error("no start input");
  fireEvent.change(start, { target: { value: "2030-01-05" } });

  expect(await save()).toEqual({
    startDay: "2030-01-05",
    reason: "vacation",
    note: null,
  });
});
