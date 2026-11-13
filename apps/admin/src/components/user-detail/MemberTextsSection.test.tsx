import type {
  MmsMessageDto,
  MmsThreadDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { render, screen, within } from "@testing-library/react";
import MemberTextsSection from "./MemberTextsSection";

const message = (overrides: Partial<MmsMessageDto>): MmsMessageDto => ({
  id: 1,
  direction: "outbound",
  body: "",
  status: "delivered",
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-11-10T18:00:00Z",
  sentByStaff: false,
  sentByName: null,
  media: [],
  ...overrides,
});

let thread: MmsThreadDto;
let threadFails: boolean;
let kimsThread: MmsThreadDto;

serveApi(
  routes({
    "GET /mms-threads/7": () =>
      threadFails
        ? Response.json({ message: "down" }, { status: 500 })
        : Response.json(thread),
    "GET /mms-threads/8": () => Response.json(kimsThread),
  }),
);

beforeEach(() => {
  threadFails = false;
  thread = {
    phoneNumber: "+14155550123",
    textable: true,
    optedOut: false,
    messages: [
      message({ id: 1, body: "New action is live" }),
      message({ id: 2, direction: "inbound", body: "What do I do?" }),
      message({
        id: 3,
        body: "Reply here",
        sentByStaff: true,
        sentByName: "Alex",
        status: "undelivered",
        errorMessage: "Unreachable destination handset",
      }),
      message({ id: 5, body: "Left the team since", sentByStaff: true }),
    ],
    hasOlder: false,
  };
  kimsThread = {
    phoneNumber: "+14155550188",
    textable: true,
    optedOut: false,
    messages: [message({ id: 6, direction: "inbound", body: "Hi" })],
    hasOlder: false,
  };
});

const renderSection = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  render(
    <Wrapper>
      <MemberTextsSection member={{ id: 7, name: "Sam" }} />
    </Wrapper>,
  );
  return client;
};

it("shows who sent each text, and why one failed", async () => {
  renderSection();

  expect(await screen.findByText("What do I do?")).toBeTruthy();
  expect(screen.getByText(/^Automated ·/)).toBeTruthy();
  expect(screen.getByText(/^Sam ·/)).toBeTruthy();
  expect(screen.getByText(/^Alex ·/)).toBeTruthy();
  expect(screen.getByText(/^Deleted user ·/)).toBeTruthy();
  expect(
    screen.getByText(/Not delivered: Unreachable destination handset/),
  ).toBeTruthy();
});

const renderSamThenKim = () => {
  const { wrapper: Wrapper, client } = queryWrapper();
  client.setQueryData(queryKeys.memberTextThreadAdmin(8), kimsThread);
  const section = (member: { id: number; name: string }) => (
    <Wrapper>
      <MemberTextsSection member={member} />
    </Wrapper>
  );
  const { rerender } = render(section({ id: 7, name: "Sam" }));
  return { moveToKim: () => rerender(section({ id: 8, name: "Kim" })) };
};

it("starts a fresh thread when the page moves to another member", async () => {
  const { moveToKim } = renderSamThenKim();
  const samsThread = await screen.findByRole("region", {
    name: "Text history",
  });

  moveToKim();

  expect(screen.getByText("Hi")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Text history" })).not.toBe(
    samsThread,
  );
});

it("marks an opted-out member", async () => {
  thread = { ...thread, optedOut: true };
  renderSection();

  expect(await screen.findByText("Opted out")).toBeTruthy();
});

it("says in the thread that a member with no phone number can't be texted", async () => {
  thread = {
    phoneNumber: null,
    textable: false,
    optedOut: false,
    messages: [],
    hasOlder: false,
  };
  renderSection();

  expect(
    await screen.findByText(
      "No phone number on file, so this member can't be texted.",
    ),
  ).toBeTruthy();
  expect(screen.getAllByText(/phone number/)).toHaveLength(1);
  expect(
    within(screen.getByRole("region", { name: "Text history" })).getByText(
      /No phone number/,
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/No texts/)).toBeNull();
});

it("dates a text from an earlier year with its year", async () => {
  thread = {
    ...thread,
    messages: [
      message({ id: 1, createdAt: "2020-03-04T12:00:00Z" }),
      message({
        id: 2,
        direction: "inbound",
        createdAt: new Date().toISOString(),
      }),
    ],
  };
  renderSection();

  expect(await screen.findByText(/^Automated · Mar 4, 2020,/)).toBeTruthy();
  expect(screen.getByText(/^Sam ·/).textContent).not.toMatch(/\d{4}/);
});

it("shows images inline, other files as downloads, and uncopied ones as loading or unavailable", async () => {
  thread = {
    ...thread,
    messages: [
      message({
        id: 4,
        direction: "inbound",
        media: [
          { id: 10, contentType: "image/jpeg", status: "ready", inline: true },
          { id: 11, contentType: "video/mp4", status: "ready", inline: false },
          { id: 12, contentType: "image/png", status: "copying", inline: true },
          {
            id: 13,
            contentType: "image/png",
            status: "unavailable",
            inline: true,
          },
        ],
      }),
    ],
  };
  renderSection();

  const image = await screen.findByAltText<HTMLImageElement>(
    "Image texted by Sam",
  );
  expect(image.src).toMatch(/\/mms-threads\/media\/10$/);
  expect(
    screen
      .getByRole("link", { name: "Download attachment (video/mp4)" })
      .getAttribute("href"),
  ).toMatch(/\/mms-threads\/media\/11$/);
  expect(screen.getByText("Attachment still loading…")).toBeTruthy();
  expect(screen.getByText("Attachment unavailable")).toBeTruthy();
});

it("says a poll failed beside the heading, keeping the thread", async () => {
  const client = renderSection();
  await screen.findByText("What do I do?");

  threadFails = true;
  await client.refetchQueries({
    queryKey: queryKeys.memberTextThreadAdmin(7),
  });

  const error = await screen.findByText(/Could not refresh texts/);
  const heading = screen.getByRole("heading", { name: "Texts" });
  expect(heading.parentElement?.contains(error)).toBe(true);
  expect(screen.getByText("What do I do?")).toBeTruthy();
});
