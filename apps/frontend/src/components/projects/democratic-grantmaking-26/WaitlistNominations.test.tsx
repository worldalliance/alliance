import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WaitlistNominations } from "./WaitlistNominations";

let sent: unknown[];
let fail: boolean;
let browserLoads: number;
serveApi(
  routes({
    "GET /waitlist/browser": () => {
      browserLoads += 1;
      return Response.json({ entry: null });
    },
    "PATCH /waitlist/browser/nominations": async ({ request }) => {
      sent.push(await request.json());
      return fail
        ? Response.json({ message: "Please try again" }, { status: 503 })
        : new Response(null, { status: 204 });
    },
  }),
);
beforeEach(() => {
  sent = [];
  fail = false;
  browserLoads = 0;
});
afterEach(cleanup);

const input = () => screen.getByRole<HTMLTextAreaElement>("textbox");
const save = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Save nominations" });

test("restores, saves, edits, and clears nominations", async () => {
  render(
    <WaitlistNominations initialValue="Example Foundation" />,
    queryWrapper(),
  );
  expect(input().value).toBe("Example Foundation");
  expect(save().disabled).toBe(true);
  fireEvent.change(input(), {
    target: { value: "  Another nonprofit\nhttps://example.org  " },
  });
  fireEvent.click(save());
  await screen.findByText("Saved");
  expect(sent).toEqual([
    { nonprofitNominations: "Another nonprofit\nhttps://example.org" },
  ]);
  expect(save().disabled).toBe(true);
  fireEvent.change(input(), { target: { value: "" } });
  expect(screen.queryByText("Saved")).toBeNull();
  fireEvent.click(save());
  await screen.findByText("Saved");
  expect(sent[1]).toEqual({ nonprofitNominations: "" });
});

test("keeps the draft and allows retry after a failure", async () => {
  fail = true;
  render(<WaitlistNominations initialValue={null} />, queryWrapper());
  fireEvent.change(input(), { target: { value: "Example Foundation" } });
  fireEvent.click(save());
  await screen.findByRole("alert");
  expect(input().value).toBe("Example Foundation");
  expect(save().disabled).toBe(false);
  fail = false;
  fireEvent.click(save());
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  await screen.findByText("Saved");
});

test("reloads the remembered entry after a save", async () => {
  render(<WaitlistNominations initialValue={null} />, queryWrapper());
  await waitFor(() => expect(browserLoads).toBe(1));
  fireEvent.change(input(), { target: { value: "Example Foundation" } });
  fireEvent.click(save());
  await screen.findByText("Saved");
  await waitFor(() => expect(browserLoads).toBe(2));
});
