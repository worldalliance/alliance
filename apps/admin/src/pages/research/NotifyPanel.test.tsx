import {
  KORA_NOTIFY_NEEDS_ACTIVE,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { notifyRealPeopleText } from "../../lib/notifyRealMembers";
import { KoraNoticeKind } from "../../lib/useKoraParticipantsAdmin";
import { ToastProvider } from "../../ui/ToastProvider";
import { NotifyPanel } from "./NotifyPanel";

let status = KoraProjectStatus.Active;
let toNotify = 3;
let moreToNotify = 0;
let notifyStatus = 200;
let notified = 0;

serveApi(
  routes({
    "GET /kora/admin/project": () =>
      Response.json({ status, canActivate: true, toNotify, moreToNotify }),
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
  moreToNotify = 0;
  notifyStatus = 200;
  notified = 0;
});

const typePhrase = (count: number) =>
  fireEvent.change(screen.getByPlaceholderText(notifyRealPeopleText(count)), {
    target: { value: notifyRealPeopleText(count) },
  });

const renderControl = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <NotifyPanel notice={KoraNoticeKind.Launch} />
      </MemoryRouter>
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
  const send = within(dialog).getByRole<HTMLButtonElement>("button", {
    name: "Send",
  });
  expect(send.disabled).toBe(true);
  fireEvent.click(send);
  expect(notified).toBe(0);

  typePhrase(3);
  fireEvent.click(send);
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
  typePhrase(3);
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Send" }),
  );
  await screen.findByText("Couldn't start sending.");
});

const renderMore = () =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <NotifyPanel notice={KoraNoticeKind.More} />
      </MemoryRouter>
    </ToastProvider>,
    queryWrapper(),
  );

test("tells earlier reviewers there's more, from its own count", async () => {
  toNotify = 0;
  renderMore();
  await screen.findByText(
    "Every reviewer who finished and has none unfinished has been told about the newest transcripts.",
  );
});

test("says who is waiting to hear there's more, by the server's rule", async () => {
  moreToNotify = 2;
  renderMore();
  await screen.findByText(
    "2 reviewers finished an assignment, have none unfinished and haven't been told about the newest transcripts.",
  );
});

test("agrees with a count of one", async () => {
  toNotify = 1;
  renderControl();
  await screen.findByText(
    "1 participant hasn't been told the reviews are open.",
  );
});
