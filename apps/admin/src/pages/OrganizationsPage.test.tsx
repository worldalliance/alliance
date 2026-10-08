import type {
  AdminWaitlistLinkDto,
  CampaignDto,
} from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import OrganizationsPage from "./OrganizationsPage";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const campaign = (
  id: number,
  fields: Partial<CampaignDto> = {},
): CampaignDto => ({
  id,
  name: `Campaign ${id}`,
  code: `code-${id}`,
  picture: null,
  kind: "campaign",
  communityId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  ...fields,
});

const link: AdminWaitlistLinkDto = {
  id: 7,
  code: "news-code",
  organizationId: 1,
  channel: "Newsletter",
  publishedAt: null,
  showReferralMessage: true,
  archivedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  entryCount: 3,
};

let requests: { method: string; path: string; body: unknown }[] = [];
let campaignPatchStatus = 200;
let linkPatchStatus = 200;
let uploadStatus = 200;
let boltName = "Bolt";
let createGate = Promise.resolve();

const record =
  (response: unknown) =>
  async ({ request }: { request: Request }) => {
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: await request.json(),
    });
    return Response.json(response);
  };

serveApi(
  routes({
    "GET /campaigns": () =>
      Response.json([
        campaign(1, { name: "Acme", kind: "organization", communityId: 20 }),
        campaign(2, { name: boltName, kind: "organization" }),
        campaign(3, { name: "Spring drive" }),
      ]),
    "GET /community/list": () =>
      Response.json([
        { id: 20, name: "Acme group" },
        { id: 21, name: "Free group" },
      ]),
    "GET /waitlist/admin/links": () => Response.json([link]),
    "POST /campaigns": async (input) => {
      const response = await record(campaign(4))(input);
      await createGate;
      return response;
    },
    "PATCH /campaigns/:id": async (input) =>
      campaignPatchStatus === 200
        ? record(campaign(2))(input)
        : Response.json(
            { message: "That group already belongs to another organization" },
            { status: campaignPatchStatus },
          ),
    "POST /waitlist/admin/links": record(link),
    "PATCH /waitlist/admin/links/:id": async (input) =>
      linkPatchStatus === 200
        ? record(link)(input)
        : Response.json({ message: "Refused" }, { status: linkPatchStatus }),
    "POST /images/uploadImage": async (input) =>
      uploadStatus === 200
        ? record({ key: "logo-key", url: "logo-url" })(input)
        : Response.json(
            { message: "Image too large" },
            { status: uploadStatus },
          ),
  }),
);

beforeEach(() => {
  requests = [];
  campaignPatchStatus = 200;
  linkPatchStatus = 200;
  uploadStatus = 200;
  boltName = "Bolt";
  createGate = Promise.resolve();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <OrganizationsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("lists organizations with their links, and notes a missing group", async () => {
  renderPage();
  expect(await screen.findByDisplayValue("Acme")).toBeTruthy();
  expect(screen.getByDisplayValue("Bolt")).toBeTruthy();
  expect(screen.queryByDisplayValue("Spring drive")).toBeNull();
  expect(screen.getByDisplayValue("Newsletter")).toBeTruthy();
  expect(screen.getAllByText(/No group assigned/)).toHaveLength(1);
});

it("creates an organization and makes a campaign one", async () => {
  renderPage();
  await screen.findByDisplayValue("Acme");
  fireEvent.change(screen.getByPlaceholderText("Name"), {
    target: { value: " Coop " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  fireEvent.change(screen.getByLabelText("Existing campaign"), {
    target: { value: "3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Make organization" }));

  await waitFor(() =>
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/campaigns",
        body: { name: "Coop", kind: "organization" },
      },
      {
        method: "PATCH",
        path: "/campaigns/3",
        body: { kind: "organization" },
      },
    ]),
  );
});

it("locks the new name while the create is pending", async () => {
  renderPage();
  await screen.findByDisplayValue("Acme");
  let respond = () => {};
  createGate = new Promise((resolve) => (respond = resolve));
  const input = screen.getByPlaceholderText<HTMLInputElement>("Name");
  input.focus();
  fireEvent.change(input, { target: { value: "Coop" } });
  fireEvent.submit(input);

  await waitFor(() => expect(input.readOnly).toBe(true));
  expect(document.activeElement).toBe(input);
  respond();
  await waitFor(() => expect(input.readOnly).toBe(false));
  expect(input.value).toBe("");
  expect(document.activeElement).toBe(input);
});

it("assigns a group, offering none another organization has", async () => {
  renderPage();
  await screen.findByDisplayValue("Bolt");
  const [, boltGroup] = screen.getAllByLabelText("Group");
  const taken = screen.getAllByRole("option", {
    name: "Acme group (another organization's)",
  });
  expect(taken).toHaveLength(1);
  expect(taken[0]).toHaveProperty("disabled", true);

  fireEvent.change(boltGroup, { target: { value: "21" } });
  await waitFor(() =>
    expect(requests).toEqual([
      { method: "PATCH", path: "/campaigns/2", body: { communityId: 21 } },
    ]),
  );
});

it("adds a link and archives one after confirming", async () => {
  renderPage();
  await screen.findByDisplayValue("Newsletter");
  const [acmeChannel] = screen.getAllByLabelText("New link's channel");
  fireEvent.change(acmeChannel, { target: { value: "Social" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Add link" })[0]);
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/waitlist/admin/links",
      body: {
        organizationId: 1,
        channel: "Social",
        publishedAt: null,
        showReferralMessage: true,
      },
    }),
  );

  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect(await screen.findByText("Archive this link?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "PATCH",
      path: "/waitlist/admin/links/7",
      body: { archived: true },
    }),
  );
});

it("can create and update a link with referral messaging disabled", async () => {
  renderPage();
  await screen.findByDisplayValue("Newsletter");
  const [channel] = screen.getAllByLabelText("New link's channel");
  fireEvent.change(channel, { target: { value: "Homepage" } });
  fireEvent.click(
    screen.getAllByRole("checkbox", {
      name: "Show referral message",
    })[0],
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Add link" })[0]);
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "POST",
      path: "/waitlist/admin/links",
      body: {
        organizationId: 1,
        channel: "Homepage",
        publishedAt: null,
        showReferralMessage: false,
      },
    }),
  );
  expect(
    screen.getAllByRole<HTMLInputElement>("checkbox", {
      name: "Show referral message",
    })[0].checked,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Show referral message for Newsletter",
    }),
  );
  await waitFor(() =>
    expect(requests).toContainEqual({
      method: "PATCH",
      path: "/waitlist/admin/links/7",
      body: { showReferralMessage: false },
    }),
  );
});

it("renames an organization when its name loses focus", async () => {
  renderPage();
  const name = await screen.findByDisplayValue("Bolt");
  fireEvent.change(name, { target: { value: " Bolt Co " } });
  fireEvent.blur(name);
  await waitFor(() =>
    expect(requests).toEqual([
      { method: "PATCH", path: "/campaigns/2", body: { name: "Bolt Co" } },
    ]),
  );
});

it("shows a name another edit changed, and saves nothing on an untouched blur", async () => {
  renderPage();
  const acme = await screen.findByDisplayValue("Acme");
  boltName = "Bolt Renamed";
  fireEvent.change(acme, { target: { value: "Acme Co" } });
  fireEvent.blur(acme);
  const bolt = await screen.findByDisplayValue("Bolt Renamed");
  fireEvent.focus(bolt);
  fireEvent.blur(bolt);
  expect(requests).toEqual([
    { method: "PATCH", path: "/campaigns/1", body: { name: "Acme Co" } },
  ]);
});

it("says why a group change was refused", async () => {
  campaignPatchStatus = 409;
  renderPage();
  await screen.findByDisplayValue("Bolt");
  const [, boltGroup] = screen.getAllByLabelText("Group");
  fireEvent.change(boltGroup, { target: { value: "21" } });
  expect(
    await screen.findByText(
      "That group already belongs to another organization",
    ),
  ).toBeTruthy();
});

it("saves a link's publication date once, when the input loses focus", async () => {
  renderPage();
  const published = await screen.findByLabelText("Publication date");
  for (const value of ["0002-01-05", "0020-01-05", "2026-01-05"]) {
    fireEvent.change(published, { target: { value } });
  }
  expect(requests).toEqual([]);
  fireEvent.blur(published);
  await waitFor(() =>
    expect(requests).toEqual([
      {
        method: "PATCH",
        path: "/waitlist/admin/links/7",
        body: { publishedAt: new Date("2026-01-05T00:00").toISOString() },
      },
    ]),
  );
});

it("renames a link's channel, and restores it when refused", async () => {
  linkPatchStatus = 400;
  renderPage();
  const channel = await screen.findByLabelText("Channel");
  fireEvent.change(channel, { target: { value: "Email" } });
  fireEvent.blur(channel);
  expect(await screen.findByText("Refused")).toBeTruthy();
  expect(screen.getByLabelText("Channel")).toHaveProperty(
    "value",
    "Newsletter",
  );
});

it("restores an archived link without confirming", async () => {
  link.archivedAt = "2026-09-02T00:00:00.000Z";
  try {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(requests).toEqual([
        {
          method: "PATCH",
          path: "/waitlist/admin/links/7",
          body: { archived: false },
        },
      ]),
    );
  } finally {
    link.archivedAt = null;
  }
});

it("uploads a logo and saves its key", async () => {
  renderPage();
  await screen.findByDisplayValue("Bolt");
  const [, boltLogo] = screen.getAllByLabelText("Upload logo");
  fireEvent.change(boltLogo, {
    target: { files: [new File(["png"], "logo.png", { type: "image/png" })] },
  });
  await waitFor(() =>
    expect(requests).toEqual([
      {
        method: "POST",
        path: "/images/uploadImage",
        body: { file: expect.stringMatching(/^data:image\/png;base64,/) },
      },
      { method: "PATCH", path: "/campaigns/2", body: { picture: "logo-key" } },
    ]),
  );
});

it("says why a logo upload failed", async () => {
  uploadStatus = 400;
  renderPage();
  await screen.findByDisplayValue("Bolt");
  const [, boltLogo] = screen.getAllByLabelText("Upload logo");
  fireEvent.change(boltLogo, {
    target: { files: [new File(["png"], "logo.png", { type: "image/png" })] },
  });
  expect(await screen.findByText("Image too large")).toBeTruthy();
  expect(requests).toEqual([]);
});

it("copies a link's URL, and says when copying fails", async () => {
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue(undefined);
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Copy link" }));
  expect(await screen.findByText("Link copied")).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith(
    expect.stringMatching(/\?link=news-code$/),
  );

  writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByText("Could not copy the link.")).toBeTruthy();
});
