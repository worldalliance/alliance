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

const renderComposer = (params: {
  send: (body: string) => Promise<unknown>;
  now: Date;
}) => {
  setNow(params.now);
  render(
    <ToastProvider>
      <TextComposer
        memberName="Sam"
        timeZone="America/Los_Angeles"
        send={params.send}
      />
    </ToastProvider>,
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
          memberName="Sam"
          timeZone="America/Los_Angeles"
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
