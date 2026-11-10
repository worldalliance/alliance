import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { KoraNotifyWaitlist } from "./KoraNotifyWaitlist";

let status = KoraProjectStatus.Active;
let toNotify = 3;
let notifyStatus = 200;
let notified = 0;

serveApi(
  routes({
    "GET /kora/admin/project": () =>
      Response.json({ status, canActivate: true, toNotify }),
    "POST /kora/admin/notify-waitlist": () => {
      if (notifyStatus !== 200) {
        return Response.json({}, { status: notifyStatus });
      }
      notified++;
      const queued = toNotify;
      toNotify = 0;
      return Response.json({ queued });
    },
  }),
);

beforeEach(() => {
  status = KoraProjectStatus.Active;
  toNotify = 3;
  notifyStatus = 200;
  notified = 0;
});

const renderControl = () =>
  render(
    <ToastProvider>
      <KoraNotifyWaitlist />
    </ToastProvider>,
    queryWrapper(),
  );

test("sends to everyone waiting only after confirming", async () => {
  renderControl();

  await screen.findByText(
    "3 participants haven't been told the reviews are open.",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Notify 3 participants" }),
  );
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Notify 3 participants?")).toBeTruthy();
  expect(notified).toBe(0);

  fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
  await screen.findByText("Sending to 3 participants");
  expect(notified).toBe(1);
  await screen.findByText(
    "Everyone on the waitlist has been told the reviews are open.",
  );
});

test("holds the send until the project is active, and says why", async () => {
  status = KoraProjectStatus.Pending;
  renderControl();

  await screen.findByText(KORA_NOTIFY_NEEDS_ACTIVE);
  const button = screen.getByRole<HTMLButtonElement>("button", {
    name: "Notify 3 participants",
  });
  expect(button.disabled).toBe(true);
});

test("has nothing to send once everyone has been told", async () => {
  toNotify = 0;
  renderControl();

  await screen.findByText(
    "Everyone on the waitlist has been told the reviews are open.",
  );
  expect(
    screen.getByRole<HTMLButtonElement>("button", {
      name: "Notify 0 participants",
    }).disabled,
  ).toBe(true);
});

test("says so when sending can't start", async () => {
  notifyStatus = 500;
  renderControl();

  fireEvent.click(
    await screen.findByRole("button", { name: "Notify 3 participants" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Send" }),
  );
  await screen.findByText("Couldn't start sending. Try again.");
});
