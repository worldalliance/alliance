import type { MmsThreadDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import type { QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { milliseconds } from "date-fns";
import MemberTextsSection from "./MemberTextsSection";

const textable = (phoneNumber: string): MmsThreadDto => ({
  phoneNumber,
  textable: true,
  optedOut: false,
  messages: [],
  hasOlder: false,
});

let thread: MmsThreadDto;
let optOuts: number;
let optOutRefusal: string | null;
let optedOutElsewhere: boolean;
let optOutGate: Promise<void>;
let kimThread: MmsThreadDto;
let kimOptOutGate: Promise<void>;

serveApi(
  routes({
    "GET /mms-threads/7": () => Response.json(thread),
    "GET /mms-threads/8": () => Response.json(kimThread),
    "POST /mms-threads/8/opt-out": async () => {
      await kimOptOutGate;
      kimThread = { ...kimThread, optedOut: true };
      return new Response(null, { status: 204 });
    },
    "POST /mms-threads/7/opt-out": async () => {
      optOuts += 1;
      await optOutGate;
      if (optedOutElsewhere) {
        thread = { ...thread, optedOut: true };
        return Response.json(
          { message: "This member has opted out of texts." },
          { status: 409 },
        );
      }
      if (optOutRefusal)
        return Response.json({ message: optOutRefusal }, { status: 400 });
      thread = { ...thread, optedOut: true };
      return new Response(null, { status: 204 });
    },
  }),
);

beforeEach(() => {
  thread = textable("+14155550123");
  optOuts = 0;
  optOutRefusal = null;
  optedOutElsewhere = false;
  optOutGate = Promise.resolve();
  kimThread = textable("+14155550188");
  kimOptOutGate = Promise.resolve();
});

const SAM = { id: 7, name: "Sam" };
const KIM = { id: 8, name: "Kim" };

const renderSection = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  client.setQueryData(queryKeys.needsReplyAdmin(), []);
  const section = (member: { id: number; name: string }) => (
    <Wrapper>
      <ToastProvider>
        <MemberTextsSection member={{ ...member, timeZone: null }} />
      </ToastProvider>
    </Wrapper>
  );
  const { rerender } = render(section(SAM));
  return {
    client,
    show: (member: { id: number; name: string }) => rerender(section(member)),
    unmount: () => rerender(<Wrapper>Loading member...</Wrapper>),
  };
};

const confirmMarkOptedOut = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Mark opted out" }),
  );
  const buttons = await screen.findAllByRole("button", {
    name: "Mark opted out",
  });
  fireEvent.click(buttons[buttons.length - 1]);
};

it("says the opt-out is pending while it is", async () => {
  optOutGate = new Promise(() => {});
  renderSection();
  await confirmMarkOptedOut();

  const button = await screen.findByRole<HTMLButtonElement>("button", {
    name: "Marking opted out…",
  });
  expect(button.disabled).toBe(true);
});

it("frees the next member's opt-out control while one is pending", async () => {
  optOutGate = new Promise(() => {});
  const { show } = renderSection();
  await confirmMarkOptedOut();
  await waitFor(() => expect(optOuts).toBe(1));

  show(KIM);

  expect(
    (
      await screen.findByRole<HTMLButtonElement>("button", {
        name: "Mark opted out",
      })
    ).disabled,
  ).toBe(false);
});

it("still shows the opt-out pending after the section remounts mid-request", async () => {
  optOutGate = new Promise(() => {});
  const { show, unmount } = renderSection();
  await confirmMarkOptedOut();
  await waitFor(() => expect(optOuts).toBe(1));

  unmount();
  show(SAM);

  const button = await screen.findByRole<HTMLButtonElement>("button", {
    name: "Marking opted out…",
  });
  expect(button.disabled).toBe(true);
});

it("marks the member the opt-out was made for when it lands after the page moves on", async () => {
  let openGate = () => {};
  optOutGate = new Promise((resolve) => (openGate = resolve));
  const { client, show } = renderSection();
  await confirmMarkOptedOut();
  await waitFor(() => expect(optOuts).toBe(1));

  show(KIM);
  await screen.findByRole("button", { name: "Mark opted out" });
  openGate();

  const cached = (userId: number) =>
    client.getQueryData<MmsThreadDto>(queryKeys.memberTextThreadAdmin(userId))
      ?.optedOut;
  await waitFor(() => expect(cached(SAM.id)).toBe(true));
  expect(cached(KIM.id)).toBe(false);
  expect(screen.queryByText("Opted out")).toBeNull();
  expect(screen.getByLabelText("Text Kim")).toBeTruthy();
  show(SAM);
  expect(await screen.findByText("Opted out")).toBeTruthy();
});

const needsReplyInvalidated = (client: QueryClient) =>
  client.getQueryState(queryKeys.needsReplyAdmin())?.isInvalidated;

it("marks a member opted out after confirming and refreshes Needs Reply", async () => {
  const { client } = renderSection();
  await confirmMarkOptedOut();

  await waitFor(() => expect(optOuts).toBe(1));
  expect(await screen.findByText("Opted out")).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByText("Opted out")),
  );
  await waitFor(() => expect(needsReplyInvalidated(client)).toBe(true));
  expect(screen.queryByLabelText("Text Sam")).toBeNull();
});

it("moves focus to the badge only once, not on a later visit", async () => {
  const { show } = renderSection();
  await confirmMarkOptedOut();
  const badge = await screen.findByText("Opted out");
  await waitFor(() => expect(document.activeElement).toBe(badge));
  badge.blur();

  show(KIM);
  await screen.findByRole("button", { name: "Mark opted out" });
  show(SAM);

  await screen.findByText("Opted out");
  expect(document.activeElement).toBe(document.body);
});

it("leaves focus where staff moved it when the opt-out lands", async () => {
  let openGate = () => {};
  optOutGate = new Promise((resolve) => (openGate = resolve));
  renderSection();
  await confirmMarkOptedOut();
  await waitFor(() => expect(optOuts).toBe(1));
  const history = screen.getByRole("region", { name: "Text history" });
  act(() => history.focus());

  openGate();

  await screen.findByText("Opted out");
  expect(document.activeElement).toBe(history);
});

it("still focuses the next member's badge after an earlier opt-out fails", async () => {
  let openSamGate = () => {};
  optOutGate = new Promise((resolve) => (openSamGate = resolve));
  let openKimGate = () => {};
  kimOptOutGate = new Promise((resolve) => (openKimGate = resolve));
  optOutRefusal = "This member's phone number isn't valid.";
  const { show } = renderSection();
  await confirmMarkOptedOut();
  await waitFor(() => expect(optOuts).toBe(1));

  show(KIM);
  await confirmMarkOptedOut();
  await screen.findByRole("button", { name: "Marking opted out…" });
  openSamGate();
  await screen.findByText("Problem marking Sam opted out");
  act(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
  openKimGate();

  const badge = await screen.findByText("Opted out");
  await waitFor(() => expect(document.activeElement).toBe(badge));
});

it("leaves a member subscribed when the confirmation is cancelled", async () => {
  renderSection();
  fireEvent.click(
    await screen.findByRole("button", { name: "Mark opted out" }),
  );
  expect(
    await screen.findByText(/Anyone else with this phone number/),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull(),
  );
  expect(optOuts).toBe(0);
  expect(screen.getByRole("button", { name: "Mark opted out" })).toBeTruthy();
});

it("says why a member wasn't marked opted out, until dismissed", async () => {
  jest.useFakeTimers();
  optOutRefusal = "This member's phone number isn't valid.";
  renderSection();
  await confirmMarkOptedOut();
  await screen.findByText("This member's phone number isn't valid.");

  act(() => jest.advanceTimersByTime(milliseconds({ minutes: 1 })));

  expect(
    screen.getByText("This member's phone number isn't valid."),
  ).toBeTruthy();
  expect(screen.getByText("Problem marking Sam opted out")).toBeTruthy();
  expect(screen.queryByText("Opted out")).toBeNull();
  expect(screen.getByRole("button", { name: "Mark opted out" })).toBeTruthy();
});

it("refreshes the thread after a failed opt-out, so a changed number shows", async () => {
  optOutRefusal = "This member's phone number isn't valid.";
  renderSection();
  await screen.findByRole("button", { name: "Mark opted out" });
  thread = { ...thread, textable: false };
  await confirmMarkOptedOut();

  await screen.findByText("Problem marking Sam opted out");
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Mark opted out" })).toBeNull(),
  );
});

it("shows a member who opted out elsewhere as opted out, without an error", async () => {
  optedOutElsewhere = true;
  renderSection();
  await confirmMarkOptedOut();

  expect(await screen.findByText("Opted out")).toBeTruthy();
  expect(screen.queryByLabelText("Text Sam")).toBeNull();
  expect(screen.queryByText("Problem marking Sam opted out")).toBeNull();
});
