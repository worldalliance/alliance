import { resetClock } from "@alliance/shared/lib/useClockMinute";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../../ui/ToastProvider";
import TextComposer from "./TextComposer";

afterEach(resetClock);

const renderComposer = (now: string) => {
  jest.spyOn(Date, "now").mockReturnValue(new Date(now).getTime());
  const sent: string[] = [];
  render(
    <ToastProvider>
      <TextComposer
        recipientName="Sam"
        phoneNumber="+14155550109"
        timeZone="America/Los_Angeles"
        newestTextId={() => 5}
        threadLoadFailed={() => false}
        onConflictShown={() => {}}
        send={async (body) => sent.push(body)}
      />
    </ToastProvider>,
  );
  const box = screen.getByLabelText("Text Sam");
  fireEvent.change(box, { target: { value: "See you Tuesday" } });
  return { sent, box };
};

it("sends on Command or Control Enter, and not on Enter alone", async () => {
  const { sent, box } = renderComposer("2026-11-11T20:00:00Z");

  fireEvent.keyDown(box, { key: "Enter" });
  expect(sent).toEqual([]);

  fireEvent.keyDown(box, { key: "Enter", metaKey: true });
  await waitFor(() => expect(sent).toEqual(["See you Tuesday"]));
});

it("doesn't answer a late-night warning from the box", async () => {
  const { sent, box } = renderComposer("2026-11-11T06:00:00Z");

  fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });
  await screen.findByRole("button", { name: "Send anyway" });
  fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });
  fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });

  expect(sent).toEqual([]);
  expect(screen.getByRole("button", { name: "Send anyway" })).toBeTruthy();
});
