import { resetClock } from "@alliance/shared/lib/useClockMinute";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { milliseconds } from "date-fns";
import { MmsThreadsLiveContext, OFFLINE } from "../../lib/mmsThreadsLive";
import TextComposer from "./TextComposer";

afterEach(resetClock);

const setNow = (now: Date) =>
  jest.spyOn(Date, "now").mockReturnValue(now.getTime());

const LATE_IN_LA = new Date("2026-11-11T06:00:00Z");
const NOON_IN_LA = new Date("2026-11-11T20:00:00Z");

const composer = () => {
  const form = screen.getByLabelText("Text Sam").closest("form");
  if (!form) throw new Error("no composer form");
  return within(form);
};

let newestTextId: number | null;
let threadLoadFailed: boolean;
beforeEach(() => {
  newestTextId = 5;
  threadLoadFailed = false;
});

const renderComposer = (params: {
  send: (body: string, afterId: number | null) => Promise<unknown>;
  now: Date;
  live?: typeof OFFLINE;
}) => {
  setNow(params.now);
  render(
    <MmsThreadsLiveContext.Provider value={params.live ?? OFFLINE}>
      <ToastProvider>
        <TextComposer
          recipientName="Sam"
          phoneNumber="+14155550109"
          timeZone="America/Los_Angeles"
          newestTextId={() => newestTextId}
          threadLoadFailed={() => threadLoadFailed}
          onConflictShown={() => {}}
          send={params.send}
        />
      </ToastProvider>
    </MmsThreadsLiveContext.Provider>,
  );
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "See you Tuesday" },
  });
};

it("sends during the day and clears the box", async () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: NOON_IN_LA });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(sent).toEqual(["See you Tuesday"]));
  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe("");
});

it("reports composing to its number", () => {
  const reported: string[] = [];
  renderComposer({
    send: async () => {},
    now: NOON_IN_LA,
    live: {
      ...OFFLINE,
      connected: true,
      reportComposing: (phoneNumber) => reported.push(phoneNumber),
    },
  });

  expect(reported).toEqual(["+14155550109"]);
});

it("keeps what the admin typed while a send was in flight", async () => {
  let finish = () => {};
  renderComposer({
    send: () => new Promise<void>((resolve) => (finish = resolve)),
    now: NOON_IN_LA,
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "One more thing" },
  });

  await act(async () => finish());

  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe(
    "One more thing",
  );
});

it("keeps focus on Send while a send is in flight, sending once", async () => {
  const sent: string[] = [];
  let finish = () => {};
  renderComposer({
    send: (body) => {
      sent.push(body);
      return new Promise<void>((resolve) => (finish = resolve));
    },
    now: NOON_IN_LA,
  });
  const send = screen.getByRole("button", { name: "Send" });
  send.focus();

  fireEvent.click(send);
  const sending = screen.getByRole("button", { name: "Sending…" });
  expect(sending.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(sending);
  fireEvent.click(sending);
  await act(async () => finish());

  expect(sent).toEqual(["See you Tuesday"]);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Send" }),
  );
});

it("warns before a late-night send and sends once confirmed", async () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: LATE_IN_LA });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(composer().getByRole("alert").textContent).toContain(
    "It's 10:00 PM for Sam",
  );
  expect(sent).toEqual([]);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Send anyway" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));
  await waitFor(() => expect(sent).toEqual(["See you Tuesday"]));
  expect(document.activeElement).toBe(screen.getByLabelText("Text Sam"));
});

it("keeps the text when the admin backs out of a late-night send", () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: LATE_IN_LA });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(screen.getByRole("button", { name: "Don't send" }));

  expect(sent).toEqual([]);
  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe(
    "See you Tuesday",
  );
  expect(composer().queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText("Text Sam"));
});

it("shows why a send failed and keeps the text", async () => {
  renderComposer({
    send: () =>
      Promise.reject({
        message: "Attempt to send to unsubscribed recipient",
        statusCode: 422,
      }),
    now: NOON_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(
    await screen.findByText("Attempt to send to unsubscribed recipient"),
  ).toBeTruthy();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe(
    "See you Tuesday",
  );
});

it("counts segments, and more of them once an emoji is in", () => {
  renderComposer({ send: async () => {}, now: NOON_IN_LA });
  expect(screen.getByText("1 segment")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: `${"a".repeat(70)}🎉` },
  });
  expect(
    screen.getByText(
      "2 segments (emoji or special characters make segments shorter)",
    ),
  ).toBeTruthy();
});

it("states the length limit before anything is typed", () => {
  renderComposer({ send: async () => {}, now: NOON_IN_LA });
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "" },
  });
  expect(screen.getByText(/^Up to 1,600 characters\./)).toBeTruthy();
});

it("says when a text is too long to send, keeping all of it", () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: NOON_IN_LA });

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "a".repeat(1601) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(composer().getByRole("alert").textContent).toBe(
    "This text is over the 1,600-character limit. Shorten it to send.",
  );
  expect(
    screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value,
  ).toHaveLength(1601);
  expect(sent).toEqual([]);
});

it("counts an emoji as two characters toward the limit, as the server does", () => {
  renderComposer({ send: async () => {}, now: NOON_IN_LA });

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: `${"a".repeat(1599)}🎉` },
  });

  expect(composer().getByRole("alert")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: `${"a".repeat(1598)}🎉` },
  });

  expect(composer().queryByRole("alert")).toBeNull();
});

it("says to write a text when Send is pressed with only spaces", () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: NOON_IN_LA });
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "  " },
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(composer().getByRole("alert").textContent).toBe(
    "Write a text to send.",
  );
  expect(sent).toEqual([]);

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "Hi" },
  });

  expect(composer().queryByRole("alert")).toBeNull();
});

it("describes the box with its hints and the message showing", () => {
  renderComposer({ send: async () => {}, now: NOON_IN_LA });
  const box = screen.getByLabelText("Text Sam");
  fireEvent.change(box, { target: { value: " " } });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  const description = (box.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
  expect(description).toContain("Their local time: ");
  expect(description).toContain("Write a text to send.");
  expect(box.getAttribute("aria-invalid")).toBe("true");
});

it("won't send an emptied text from the late-night warning", () => {
  const sent: string[] = [];
  renderComposer({ send: async (body) => sent.push(body), now: LATE_IN_LA });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: " " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));

  expect(screen.getByText("Write a text to send.")).toBeTruthy();
  expect(sent).toEqual([]);
});

it("keeps a failure that lands after the composer closed until dismissed, with the text", async () => {
  jest.useFakeTimers();
  setNow(NOON_IN_LA);
  let fail = (_thrown: unknown) => {};
  const send = () => new Promise((_resolve, reject) => (fail = reject));
  const composerFor = (open: boolean) => (
    <ToastProvider>
      {open && (
        <TextComposer
          recipientName="Sam"
          phoneNumber="+14155550101"
          timeZone="America/Los_Angeles"
          newestTextId={() => null}
          threadLoadFailed={() => false}
          onConflictShown={() => {}}
          send={send}
        />
      )}
    </ToastProvider>
  );
  const { rerender } = render(composerFor(true));
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "See you Tuesday" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  rerender(composerFor(false));
  await act(async () => fail(new Error("timeout")));
  act(() => jest.advanceTimersByTime(milliseconds({ minutes: 1 })));

  expect(screen.getByText("Problem sending text to Sam")).toBeTruthy();
  expect(screen.getByText(/Your text: "See you Tuesday"/)).toBeTruthy();
});

it("keeps the member's local time current", () => {
  jest.useFakeTimers();
  renderComposer({ send: async () => {}, now: NOON_IN_LA });
  expect(screen.getByText("Their local time: 12:00 PM")).toBeTruthy();

  // bun's timer advance drops a setSystemTime value and reads the real clock.
  setNow(new Date(NOON_IN_LA.getTime() + milliseconds({ minutes: 1 })));
  act(() => jest.advanceTimersByTime(milliseconds({ minutes: 1 })));

  expect(screen.getByText("Their local time: 12:01 PM")).toBeTruthy();
});

it("keeps the text and asks again when newer texts arrived while writing", async () => {
  const sent: string[] = [];
  let refuse = true;
  renderComposer({
    send: async (body) => {
      if (refuse) {
        refuse = false;
        newestTextId = 6;
        throw { statusCode: 409, error: "newer_texts" };
      }
      sent.push(body);
    },
    now: NOON_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(composer().getByRole("alert").textContent).toContain(
      "New texts arrived while you were writing",
    ),
  );
  expect(screen.getByLabelText<HTMLTextAreaElement>("Text Sam").value).toBe(
    "See you Tuesday",
  );
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));
  await waitFor(() => expect(sent).toEqual(["See you Tuesday"]));
  expect(composer().queryByRole("alert")).toBeNull();
  expect(document.activeElement).toBe(screen.getByLabelText("Text Sam"));
});

it("asks about quiet hours when they began while staff read the newer texts", async () => {
  jest.useFakeTimers();
  const beforeEight = new Date("2026-11-12T03:59:00Z");
  const sent: string[] = [];
  let refuse = true;
  renderComposer({
    send: async (body) => {
      if (refuse) {
        refuse = false;
        newestTextId = 6;
        throw { statusCode: 409, error: "newer_texts" };
      }
      sent.push(body);
    },
    now: beforeEight,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await act(async () => {});
  expect(composer().getByRole("alert").textContent).toContain(
    "New texts arrived",
  );
  setNow(new Date(beforeEight.getTime() + milliseconds({ minutes: 1 })));
  act(() => jest.advanceTimersByTime(milliseconds({ minutes: 1 })));
  expect(screen.getByText("Their local time: 8:00 PM")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));

  expect(composer().getByRole("alert").textContent).toContain(
    "It's 8:00 PM for Sam",
  );
  expect(sent).toEqual([]);
});

it("doesn't ask about quiet hours again after newer texts refuse a confirmed send", async () => {
  const sent: string[] = [];
  let refuse = true;
  renderComposer({
    send: async (body) => {
      if (refuse) {
        refuse = false;
        newestTextId = 6;
        throw { statusCode: 409, error: "newer_texts" };
      }
      sent.push(body);
    },
    now: LATE_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));
  await waitFor(() =>
    expect(composer().getByRole("alert").textContent).toContain(
      "New texts arrived",
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));

  await waitFor(() => expect(sent).toEqual(["See you Tuesday"]));
  expect(composer().queryByRole("alert")).toBeNull();
});

it("says the new texts couldn't be loaded when the refetch after the refusal failed", async () => {
  renderComposer({
    send: () => {
      // The admin's own text, sent while this draft was written, is newer
      // than the draft's record but isn't what refused the send.
      newestTextId = 6;
      threadLoadFailed = true;
      return Promise.reject({ statusCode: 409, error: "newer_texts" });
    },
    now: NOON_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(composer().getByRole("alert").textContent).toContain(
      "New texts arrived but couldn't be loaded.",
    ),
  );
  expect(screen.queryByRole("button", { name: "Send anyway" })).toBeNull();
});

it.each([
  ["an opted-out refusal", undefined, "This member has opted out of texts."],
  ["a conflict it doesn't recognise", "some_later_conflict", "Thread changed."],
])("shows %s as an error, not as a warning", async (_, error, message) => {
  renderComposer({
    send: () => Promise.reject({ statusCode: 409, error, message }),
    now: NOON_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(composer().getByRole("alert").textContent).toContain(message),
  );
  expect(screen.queryByRole("button", { name: "Send anyway" })).toBeNull();
});

it("warns that the member's number changed when the draft's thread is gone", async () => {
  renderComposer({
    send: () => Promise.reject({ statusCode: 409, error: "number_changed" }),
    now: NOON_IN_LA,
  });

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(composer().getByRole("alert").textContent).toContain(
      "This member's phone number changed while you were writing. Check the thread above before you send.",
    ),
  );
  expect(screen.getByRole("button", { name: "Send anyway" })).toBeTruthy();
});

it("checks for newer texts from when the draft started, and from what a warning showed", async () => {
  const afterIds: (number | null)[] = [];
  renderComposer({
    send: async (_, afterId) => {
      afterIds.push(afterId);
      if (afterIds.length === 1)
        throw { statusCode: 409, error: "newer_texts" };
    },
    now: NOON_IN_LA,
  });
  newestTextId = 6;

  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  newestTextId = 7;
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send anyway" })).toBeTruthy(),
  );
  newestTextId = 8;
  fireEvent.click(screen.getByRole("button", { name: "Send anyway" }));
  await waitFor(() => expect(afterIds).toEqual([5, 7]));

  newestTextId = 9;
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "And Wednesday" },
  });
  newestTextId = 10;
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(afterIds).toEqual([5, 7, 9]));
});

it("checks a draft written during a send from where it started, not from what that send brought in", async () => {
  const afterIds: (number | null)[] = [];
  let finish = () => {};
  renderComposer({
    send: (_, afterId) => {
      afterIds.push(afterId);
      return new Promise<void>((resolve) => (finish = resolve));
    },
    now: NOON_IN_LA,
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.change(screen.getByLabelText("Text Sam"), {
    target: { value: "One more thing" },
  });
  newestTextId = 7;
  await act(async () => finish());

  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() => expect(afterIds).toEqual([5, 5]));
});

it("warns of newer texts when the draft restarted while its refused send was in flight", async () => {
  let refuse = () => {};
  renderComposer({
    send: () =>
      new Promise((_, reject) => {
        refuse = () => reject({ statusCode: 409, error: "newer_texts" });
      }),
    now: NOON_IN_LA,
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  newestTextId = 6;
  const box = screen.getByLabelText("Text Sam");
  fireEvent.change(box, { target: { value: "" } });
  fireEvent.change(box, { target: { value: "Actually, Wednesday" } });
  await act(async () => refuse());

  expect(screen.getByRole("button", { name: "Send anyway" })).toBeTruthy();
  expect(screen.queryByText(/couldn't be loaded/)).toBeNull();
});
