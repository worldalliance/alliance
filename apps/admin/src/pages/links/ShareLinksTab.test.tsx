import type {
  CampaignDto,
  ExternalShareTargetDto,
  ProfileDto,
  ShareUrlAdminDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as config from "@alliance/sharedweb/lib/config";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { sessionExpiredMessage } from "../../lib/sessionExpired";
import { adminActionListItem } from "../../lib/testing/adminActionListItem";
import { ToastProvider } from "../../ui/ToastProvider";
import { pickUser } from "../../ui/UserSelect.testing";
import { chooseRowAction } from "./chooseRowAction.testing";
import { ShareLinksTab } from "./ShareLinksTab";

const campaign = (id: number, name: string): CampaignDto => ({
  id,
  name,
  code: `spring${id}`,
  picture: null,
  invitePageDescription: null,
  kind: "campaign",
  communityId: null,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
});

let actionsStatus = 200;
let targetsStatus = 200;
let campaignsStatus = 200;
let campaigns = [campaign(7, "Spring fundraiser")];
let createCampaignStatus = 200;
let actionsGate = Promise.resolve();
let targetsGate = Promise.resolve();
let membersStatus = 200;
let uploadStatus = 200;

const shareLink = (id: string, label: string | null) =>
  ({
    id,
    kind: "action",
    sid: null,
    url: `https://example.com/s/${id}`,
    duplicate: true,
    label,
    userId: 5,
    campaignId: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    signupCount: 0,
    action: { id: 1, name: "Call your rep" },
  }) satisfies ShareUrlAdminDto;

let userLinks: ShareUrlAdminDto[] = [];
let userLinksStatus = 200;
let labelStatus = 200;
let duplicateStatus = 200;
let deleteStatus = 200;

serveApi(
  routes({
    "GET /actions/all": async () => {
      await actionsGate;
      return actionsStatus === 200
        ? Response.json([
            adminActionListItem(1, "Call your rep"),
            adminActionListItem(3, "Share the video"),
            adminActionListItem(2, "Old petition", { archived: true }),
          ])
        : Response.json({}, { status: actionsStatus });
    },
    "GET /external-share-targets": async () => {
      await targetsGate;
      return targetsStatus === 200
        ? Response.json([
            {
              id: 3,
              name: "Partner petition",
              url: "https://example.com/petition",
              paramName: "ref",
              createdAt: "2026-01-02T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            } satisfies ExternalShareTargetDto,
          ])
        : Response.json({}, { status: targetsStatus });
    },
    "GET /campaigns": () =>
      campaignsStatus === 200
        ? Response.json(campaigns)
        : Response.json({}, { status: campaignsStatus }),
    "POST /campaigns": async ({ request }) => {
      if (createCampaignStatus !== 200)
        return Response.json({}, { status: createCampaignStatus });
      const {
        name,
        invitePageDescription,
      }: { name: string; invitePageDescription?: string | null } =
        await request.json();
      const created = {
        ...campaign(8, name),
        invitePageDescription: invitePageDescription ?? null,
      };
      campaigns = [...campaigns, created];
      return Response.json(created);
    },
    "GET /share-urls/for-user/:userId": () =>
      userLinksStatus === 200
        ? Response.json(userLinks)
        : Response.json({}, { status: userLinksStatus }),
    "PATCH /share-urls/:id/label": async ({ request, params }) => {
      if (labelStatus !== 200)
        return Response.json(
          { message: "Label is too long" },
          { status: labelStatus },
        );
      const { label }: { label: string } = await request.json();
      return Response.json(shareLink(params.id, label));
    },
    "DELETE /share-urls/:id": () =>
      new Response(null, { status: deleteStatus }),
    "POST /share-urls/create-duplicate": async ({ request }) => {
      if (duplicateStatus !== 200)
        return Response.json(
          { message: "That action is archived" },
          { status: duplicateStatus },
        );
      const { label }: { label?: string } = await request.json();
      return Response.json(shareLink("dup", label ?? null));
    },
    "GET /share-urls/for-campaign/:campaignId": () => Response.json([]),
    "POST /images/uploadImage": () =>
      uploadStatus === 200
        ? Response.json({ key: "img-1", url: "https://example.com/img-1" })
        : Response.json(
            { message: "Image is too large" },
            { status: uploadStatus },
          ),
    "GET /user/members": () =>
      membersStatus !== 200
        ? Response.json({}, { status: membersStatus })
        : Response.json([
            {
              id: 5,
              admin: false,
              staff: false,
              ambassador: false,
              profilePicture: null,
              profileDescription: null,
              anonymous: false,
              displayName: "Test Member",
              hasActiveContract: true,
              isCommunityLeader: false,
            } satisfies ProfileDto,
          ]),
  }),
);

beforeEach(() => {
  actionsStatus = 200;
  targetsStatus = 200;
  campaignsStatus = 200;
  campaigns = [campaign(7, "Spring fundraiser")];
  createCampaignStatus = 200;
  actionsGate = Promise.resolve();
  targetsGate = Promise.resolve();
  membersStatus = 200;
  uploadStatus = 200;
  userLinks = [];
  userLinksStatus = 200;
  labelStatus = 200;
  duplicateStatus = 200;
  deleteStatus = 200;
});

const renderTab = (query = queryWrapper()) =>
  render(
    <MemoryRouter initialEntries={["/growth/links"]}>
      <ToastProvider>
        <ShareLinksTab />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );

it("says the users failed to load instead of offering none", async () => {
  membersStatus = 500;
  renderTab();

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

const pickOwner = async (query = queryWrapper()) => {
  renderTab(query);
  const userSearch = await screen.findByRole("combobox", { name: "Member" });
  await pickUser(userSearch, { query: "Test", name: /Test Member/ });
  return screen.findByLabelText("Task");
};

const openPicker = (name: string, text?: string) => {
  const box = screen.getByRole("combobox", { name });
  fireEvent.keyDown(box, { key: "ArrowDown" });
  if (text !== undefined) fireEvent.input(box, { target: { value: text } });
  return box;
};

it("offers the loaded tasks that are not archived as targets", async () => {
  await pickOwner();
  openPicker("Task");
  expect(
    await screen.findByRole("option", { name: "Call your rep" }),
  ).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Old petition" })).toBeNull();
});

it("says the tasks are loading instead of offering none", async () => {
  let release = () => {};
  actionsGate = new Promise((resolve) => (release = resolve));
  await pickOwner();
  openPicker("Task");
  expect(await screen.findByText("Loading")).toBeTruthy();

  release();
  expect(
    await screen.findByRole("option", { name: "Call your rep" }),
  ).toBeTruthy();
});

it("filters the tasks by any word of their name as staff type", async () => {
  await pickOwner();
  openPicker("Task", "video");
  await waitFor(() =>
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Share the video",
    ]),
  );
});

it("says the tasks failed to load instead of offering none", async () => {
  actionsStatus = 500;
  await pickOwner();
  expect(await screen.findByText("Couldn't load tasks.")).toBeTruthy();
});

it("says the session expired when the tasks load is refused with a 401", async () => {
  actionsStatus = 401;
  await pickOwner();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps offering the loaded tasks when a refetch fails", async () => {
  const query = queryWrapper();
  await pickOwner(query);
  openPicker("Task");
  await screen.findByRole("option", { name: "Call your rep" });

  actionsStatus = 500;
  await act(() => query.client.refetchQueries());
  await waitFor(() =>
    expect(
      query.client.getQueryState(queryKeys.actionsAllAdmin())?.status,
    ).toBe("error"),
  );
  await act(async () => {});

  expect(screen.queryByText("Couldn't load tasks.")).toBeNull();
  expect(screen.getByRole("option", { name: "Call your rep" })).toBeTruthy();
});

const pickExternalKind = async () => {
  await pickOwner();
  fireEvent.change(screen.getByLabelText("Link to"), {
    target: { value: "external" },
  });
  await screen.findByLabelText("Share target");
};

it("offers the loaded external share targets", async () => {
  await pickExternalKind();
  openPicker("Share target");
  expect(
    await screen.findByRole("option", { name: "Partner petition" }),
  ).toBeTruthy();
  expect(screen.queryByRole("option", { name: "Call your rep" })).toBeNull();
});

it("says the external share targets are loading instead of offering none", async () => {
  let release = () => {};
  targetsGate = new Promise((resolve) => (release = resolve));
  await pickExternalKind();
  openPicker("Share target");
  expect(await screen.findByText("Loading")).toBeTruthy();

  release();
  expect(
    await screen.findByRole("option", { name: "Partner petition" }),
  ).toBeTruthy();
});

it("says the external share targets failed to load", async () => {
  targetsStatus = 500;
  await pickExternalKind();
  expect(await screen.findByText("Couldn't load share targets.")).toBeTruthy();
});

const pickCampaignKind = async () => {
  jest
    .spyOn(config, "getInviteBaseUrl")
    .mockReturnValue("https://test.alliance/");
  renderTab();
  fireEvent.change(await screen.findByLabelText("Links of"), {
    target: { value: "campaign" },
  });
};

it("gives a campaign's signup link on the invite domain", async () => {
  await pickCampaignKind();
  await screen.findByRole("option", { name: "Spring fundraiser" });
  fireEvent.change(screen.getByLabelText("Campaign"), {
    target: { value: "7" },
  });

  expect(
    await screen.findByDisplayValue("https://test.alliance/signup?ref=spring7"),
  ).toBeTruthy();
});

const openNewCampaign = async (name: string) => {
  fireEvent.click(await screen.findByRole("button", { name: "New campaign…" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Name"), {
    target: { value: name },
  });
  return dialog;
};

it("returns focus to New campaign when its dialog closes", async () => {
  await pickCampaignKind();
  const trigger = await screen.findByRole("button", { name: "New campaign…" });
  trigger.focus();
  const dialog = await openNewCampaign("Fall drive");
  await waitFor(() =>
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Name")),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("lists and selects a campaign it creates", async () => {
  await pickCampaignKind();
  await screen.findByRole("option", { name: "Spring fundraiser" });

  const dialog = await openNewCampaign("Fall drive");
  fireEvent.change(within(dialog).getByLabelText(/^Invite page description/), {
    target: { value: "Join us this fall" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create campaign" }),
  );

  expect(
    await screen.findByRole("option", { name: "Fall drive", selected: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole("option", { name: "Spring fundraiser" }),
  ).toBeTruthy();
  expect(campaigns.find((c) => c.name === "Fall drive")).toMatchObject({
    invitePageDescription: "Join us this fall",
  });
});

it("says when it cannot create a campaign", async () => {
  createCampaignStatus = 500;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickCampaignKind();

  const dialog = await openNewCampaign("Fall drive");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create campaign" }),
  );

  expect(
    await within(dialog).findByText("Couldn't create the campaign."),
  ).toBeTruthy();
  expect(within(dialog).getByDisplayValue("Fall drive")).toBeTruthy();
});

it("says the session expired when a campaign create is refused for it", async () => {
  createCampaignStatus = 401;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickCampaignKind();

  const dialog = await openNewCampaign("Fall drive");
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create campaign" }),
  );

  expect(await within(dialog).findByText(sessionExpiredMessage)).toBeTruthy();
});

it("says why a campaign image upload was refused", async () => {
  uploadStatus = 400;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickCampaignKind();

  const dialog = await openNewCampaign("Fall drive");
  fireEvent.change(within(dialog).getByLabelText(/^Picture/), {
    target: { files: [new File(["x"], "pic.png", { type: "image/png" })] },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create campaign" }),
  );

  expect(await within(dialog).findByText("Image is too large")).toBeTruthy();
  expect(campaigns.map((c) => c.name)).toEqual(["Spring fundraiser"]);
});

it("says the campaigns failed to load", async () => {
  campaignsStatus = 500;
  await pickCampaignKind();
  expect(await screen.findByText("Couldn't load campaigns.")).toBeTruthy();
});

it("lists the owner's share links", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  await pickOwner();
  expect(await screen.findByText("Newsletter")).toBeTruthy();
  expect(screen.getByText("https://example.com/s/a")).toBeTruthy();
});

it("keeps the owner in the URL", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  render(
    <MemoryRouter initialEntries={["/growth/links?member=5"]}>
      <ToastProvider>
        <ShareLinksTab />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  expect(await screen.findByText("Newsletter")).toBeTruthy();
});

it("says the share links failed to load instead of listing none", async () => {
  userLinksStatus = 500;
  await pickOwner();
  expect(await screen.findByText("Couldn't load share links")).toBeTruthy();
  expect(screen.queryByText(/has no share links yet/)).toBeNull();
});

const createDuplicateFlyer = async () => {
  await pickOwner();
  const box = openPicker("Task", "rep");
  await screen.findByRole("option", { name: "Call your rep" });
  fireEvent.keyDown(box, { key: "Enter" });
  fireEvent.change(screen.getByLabelText(/^Label/), {
    target: { value: "Flyer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create duplicate" }));
};

it("lists a duplicate it creates", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  await createDuplicateFlyer();

  expect(await screen.findByText("Flyer")).toBeTruthy();
  expect(screen.getByText("Newsletter")).toBeTruthy();
});

const renameNewsletter = async () => {
  await pickOwner();
  await chooseRowAction("Newsletter", "Edit label…");
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByDisplayValue("Newsletter"), {
    target: { value: "Poster" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save label" }));
  return dialog;
};

it("shows a renamed label", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  await renameNewsletter();

  expect(await screen.findByRole("cell", { name: "Poster" })).toBeTruthy();
  expect(screen.getByText("Label updated")).toBeTruthy();
});

it("says why a label update was refused and keeps editing", async () => {
  labelStatus = 400;
  userLinks = [shareLink("a", "Newsletter")];
  jest.spyOn(console, "error").mockImplementation(() => {});
  const dialog = await renameNewsletter();

  expect(await within(dialog).findByText("Label is too long")).toBeTruthy();
  expect(within(dialog).getByDisplayValue("Poster")).toBeTruthy();
});

const deleteNewsletter = async () => {
  await pickOwner();
  await chooseRowAction("Newsletter", "Delete");
  fireEvent.click(await screen.findByRole("button", { name: "Delete link" }));
};

it("drops a link it deletes", async () => {
  userLinks = [shareLink("a", "Newsletter"), shareLink("b", "Poster")];
  await deleteNewsletter();

  expect(await screen.findByText("Share link deleted")).toBeTruthy();
  expect(screen.queryByText("Newsletter")).toBeNull();
  expect(screen.getByText("Poster")).toBeTruthy();
});

it("says deleting an external target link changes no Alliance page", async () => {
  userLinks = [
    {
      ...shareLink("b", "Partner post"),
      kind: "externalTarget",
      action: null,
      externalTarget: { id: 4, name: "Partner X signup" },
    },
  ];
  await pickOwner();
  await chooseRowAction("Partner post", "Delete");
  expect(
    await screen.findByText(/still reaches the partner's page as before/),
  ).toBeTruthy();
  expect(screen.queryByText(/the page no longer names them/)).toBeNull();
});

it("says why a duplicate was refused and keeps its label", async () => {
  duplicateStatus = 400;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await createDuplicateFlyer();

  expect(await screen.findByText("That action is archived")).toBeTruthy();
  expect(screen.getByDisplayValue("Flyer")).toBeTruthy();
});

it("says when it cannot delete a link and keeps it", async () => {
  deleteStatus = 500;
  userLinks = [shareLink("a", "Newsletter")];
  jest.spyOn(console, "error").mockImplementation(() => {});
  await deleteNewsletter();

  expect(
    await screen.findByText("Couldn't delete the share link “Newsletter”."),
  ).toBeTruthy();
  expect(screen.getByText("Newsletter")).toBeTruthy();
});
