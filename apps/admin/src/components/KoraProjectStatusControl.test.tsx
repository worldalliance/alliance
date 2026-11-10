import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { KoraProjectStatusControl } from "./KoraProjectStatusControl";

let status = KoraProjectStatus.Pending;
let loadStatus = 200;
let saveStatus = 200;
const saved: string[] = [];

serveApi(
  routes({
    "GET /kora/admin/project": () =>
      loadStatus === 200
        ? Response.json({ status, canActivate: false })
        : Response.json({}, { status: loadStatus }),
    "PUT /kora/admin/project": async ({ request }) => {
      if (saveStatus !== 200) {
        return Response.json({}, { status: saveStatus });
      }
      const body = (await request.json()) as { status: KoraProjectStatus };
      saved.push(body.status);
      status = body.status;
      return Response.json({ status, canActivate: false });
    },
  }),
);

beforeEach(() => {
  status = KoraProjectStatus.Pending;
  loadStatus = 200;
  saveStatus = 200;
  saved.length = 0;
});

const renderControl = () =>
  render(
    <ToastProvider>
      <KoraProjectStatusControl />
    </ToastProvider>,
    queryWrapper(),
  );

const radio = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name: new RegExp(`^${name}`) });

test("shows the current status, with Active disabled and why", async () => {
  renderControl();

  await screen.findByRole("group", { name: "Project status" });
  expect(radio("Pending").checked).toBe(true);
  expect(radio("Active").disabled).toBe(true);
  expect(screen.getByText(KORA_ACTIVE_NEEDS_TRANSCRIPTS)).toBeTruthy();
});

test("closes the project only after confirming", async () => {
  renderControl();

  await screen.findByRole("group", { name: "Project status" });
  fireEvent.click(radio("Closed"));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Make the project Closed?")).toBeTruthy();
  expect(saved).toEqual([]);

  fireEvent.click(within(dialog).getByRole("button", { name: "Make Closed" }));
  await screen.findByText("Project is now Closed");
  expect(saved).toEqual([KoraProjectStatus.Closed]);
  expect(radio("Closed").checked).toBe(true);
});

test("leaves the status alone when the change is cancelled", async () => {
  renderControl();

  await screen.findByRole("group", { name: "Project status" });
  fireEvent.click(radio("Closed"));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(saved).toEqual([]);
  expect(radio("Pending").checked).toBe(true);
});

test("says so when the change fails", async () => {
  saveStatus = 500;
  renderControl();

  await screen.findByRole("group", { name: "Project status" });
  fireEvent.click(radio("Closed"));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Make Closed",
    }),
  );
  await screen.findByText("Couldn't change the status. Try again.");
  expect(radio("Pending").checked).toBe(true);
});

test("says so when the status can't load", async () => {
  loadStatus = 500;
  renderControl();

  const message = await screen.findByText(
    "Couldn't load the project status. Reload to try again.",
  );
  expect(message.getAttribute("role")).toBe("alert");
});
