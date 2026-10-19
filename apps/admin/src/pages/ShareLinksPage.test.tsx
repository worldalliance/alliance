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
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import ShareLinksPage from "./ShareLinksPage";

afterEach(cleanup);

const campaign = (id: number, name: string) =>
  ({
    id,
    name,
    code: `spring${id}`,
    picture: null,
    kind: "campaign",
    communityId: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  }) satisfies CampaignDto;

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
      const { name }: { name: string } = await request.json();
      const created = campaign(8, name);
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

it("says the users failed to load instead of offering none", async () => {
  membersStatus = 500;
  render(
    <ToastProvider>
      <ShareLinksPage />
    </ToastProvider>,
    queryWrapper(),
  );

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

const pickOwner = async (query = queryWrapper()) => {
  render(
    <ToastProvider>
      <ShareLinksPage />
    </ToastProvider>,
    query,
  );
  const [userSearch] = await screen.findAllByRole("textbox");
  fireEvent.change(userSearch, { target: { value: "Test" } });
  fireEvent.click(await screen.findByRole("button", { name: /Test Member/ }));
  return screen.findByPlaceholderText("Search actions…");
};

it("offers the loaded actions that are not archived as targets", async () => {
  fireEvent.focus(await pickOwner());
  expect(
    await screen.findByRole("button", { name: "Call your rep" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Old petition" })).toBeNull();
});

it("says the actions are loading instead of offering none", async () => {
  let release = () => {};
  actionsGate = new Promise((resolve) => (release = resolve));
  fireEvent.focus(await pickOwner());
  expect(screen.getByText("Loading actions…")).toBeTruthy();
  expect(screen.queryByText("No matches.")).toBeNull();

  release();
  expect(
    await screen.findByRole("button", { name: "Call your rep" }),
  ).toBeTruthy();
});

it("says the actions failed to load instead of offering none", async () => {
  actionsStatus = 500;
  await pickOwner();
  expect(await screen.findByText("Failed to load actions")).toBeTruthy();
});

it("says the session expired when the actions load is refused with a 401", async () => {
  actionsStatus = 401;
  await pickOwner();
  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("keeps offering the loaded actions when a refetch fails", async () => {
  const query = queryWrapper();
  fireEvent.focus(await pickOwner(query));
  await screen.findByRole("button", { name: "Call your rep" });

  actionsStatus = 500;
  await act(() => query.client.refetchQueries());
  await waitFor(() =>
    expect(
      query.client.getQueryState(queryKeys.actionsAllAdmin())?.status,
    ).toBe("error"),
  );
  await act(async () => {});

  expect(screen.queryByText("Failed to load actions")).toBeNull();
  expect(screen.getByRole("button", { name: "Call your rep" })).toBeTruthy();
});

const pickExternalKind = async () => {
  await pickOwner();
  fireEvent.change(screen.getByDisplayValue("Action"), {
    target: { value: "external" },
  });
  return screen.findByPlaceholderText("Search external targets…");
};

it("offers the loaded external share targets", async () => {
  fireEvent.focus(await pickExternalKind());
  expect(
    await screen.findByRole("button", { name: "Partner petition" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Call your rep" })).toBeNull();
});

it("says the external share targets are loading instead of offering none", async () => {
  let release = () => {};
  targetsGate = new Promise((resolve) => (release = resolve));
  fireEvent.focus(await pickExternalKind());
  expect(screen.getByText("Loading external targets…")).toBeTruthy();
  expect(screen.queryByText("No matches.")).toBeNull();

  release();
  expect(
    await screen.findByRole("button", { name: "Partner petition" }),
  ).toBeTruthy();
});

it("says the external share targets failed to load", async () => {
  targetsStatus = 500;
  await pickExternalKind();
  expect(await screen.findByText("Failed to load share targets.")).toBeTruthy();
});

const pickCampaignKind = async () => {
  jest
    .spyOn(config, "getInviteBaseUrl")
    .mockReturnValue("https://test.alliance/");
  render(
    <ToastProvider>
      <ShareLinksPage />
    </ToastProvider>,
    queryWrapper(),
  );
  fireEvent.change(await screen.findByDisplayValue("User"), {
    target: { value: "campaign" },
  });
};

it("gives a campaign's signup link on the invite domain", async () => {
  await pickCampaignKind();
  await screen.findByRole("option", { name: "Spring fundraiser" });
  fireEvent.change(screen.getByDisplayValue("Select a campaign…"), {
    target: { value: "7" },
  });

  expect(
    await screen.findByText("https://test.alliance/signup?ref=spring7"),
  ).toBeTruthy();
});

it("lists and selects a campaign it creates", async () => {
  await pickCampaignKind();
  await screen.findByRole("option", { name: "Spring fundraiser" });

  fireEvent.change(screen.getByPlaceholderText(/Campaign name/), {
    target: { value: "Fall drive" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(
    await screen.findByRole("option", { name: "Fall drive", selected: true }),
  ).toBeTruthy();
  expect(
    screen.getByRole("option", { name: "Spring fundraiser" }),
  ).toBeTruthy();
});

it("says when it cannot create a campaign", async () => {
  createCampaignStatus = 500;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickCampaignKind();

  fireEvent.change(await screen.findByPlaceholderText(/Campaign name/), {
    target: { value: "Fall drive" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText("Failed to create campaign.")).toBeTruthy();
  expect(screen.getByDisplayValue("Fall drive")).toBeTruthy();
});

it("says the session expired when a campaign create is refused for it", async () => {
  createCampaignStatus = 401;
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickCampaignKind();

  fireEvent.change(await screen.findByPlaceholderText(/Campaign name/), {
    target: { value: "Fall drive" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

  expect(await screen.findByText(sessionExpiredMessage)).toBeTruthy();
});

it("says why a campaign image upload was refused", async () => {
  uploadStatus = 400;
  jest.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(
    <ToastProvider>
      <ShareLinksPage />
    </ToastProvider>,
    queryWrapper(),
  );
  fireEvent.change(await screen.findByDisplayValue("User"), {
    target: { value: "campaign" },
  });
  const input = await waitFor(() => {
    const found = container.querySelector('input[type="file"]');
    if (!found) throw new Error("no file input");
    return found;
  });
  fireEvent.change(input, {
    target: { files: [new File(["x"], "pic.png", { type: "image/png" })] },
  });

  expect(await screen.findByText("Image is too large")).toBeTruthy();
  expect(screen.queryByAltText("Campaign avatar preview")).toBeNull();
});

it("says the campaigns failed to load", async () => {
  campaignsStatus = 500;
  await pickCampaignKind();
  expect(await screen.findByText("Failed to load campaigns.")).toBeTruthy();
});

it("lists the owner's share links", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  await pickOwner();
  expect(await screen.findByText("Newsletter")).toBeTruthy();
  expect(screen.getByText("https://example.com/s/a")).toBeTruthy();
});

it("says the share links failed to load instead of listing none", async () => {
  userLinksStatus = 500;
  await pickOwner();
  expect(await screen.findByText("Failed to load share links.")).toBeTruthy();
  expect(screen.queryByText(/has no share links yet/)).toBeNull();
});

it("lists a duplicate it creates", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  fireEvent.focus(await pickOwner());
  fireEvent.click(await screen.findByRole("button", { name: "Call your rep" }));
  fireEvent.change(screen.getByPlaceholderText(/label/i), {
    target: { value: "Flyer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create duplicate" }));

  expect(await screen.findByText("Flyer")).toBeTruthy();
  expect(screen.getByText("Newsletter")).toBeTruthy();
});

it("shows a renamed label", async () => {
  userLinks = [shareLink("a", "Newsletter")];
  await pickOwner();
  fireEvent.click(await screen.findByRole("button", { name: "Edit label" }));
  fireEvent.change(screen.getByDisplayValue("Newsletter"), {
    target: { value: "Poster" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Poster")).toBeTruthy();
  expect(screen.getByText("Label updated")).toBeTruthy();
});

it("says why a label update was refused and keeps editing", async () => {
  labelStatus = 400;
  userLinks = [shareLink("a", "Newsletter")];
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickOwner();
  fireEvent.click(await screen.findByRole("button", { name: "Edit label" }));
  fireEvent.change(screen.getByDisplayValue("Newsletter"), {
    target: { value: "Poster" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByText("Label is too long")).toBeTruthy();
  expect(screen.getByDisplayValue("Poster")).toBeTruthy();
});

it("drops a link it deletes", async () => {
  userLinks = [shareLink("a", "Newsletter"), shareLink("b", "Poster")];
  await pickOwner();
  await screen.findByText("Newsletter");
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(3),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[2]);

  expect(await screen.findByText("Share link deleted")).toBeTruthy();
  expect(screen.queryByText("Newsletter")).toBeNull();
  expect(screen.getByText("Poster")).toBeTruthy();
});

it("says why a duplicate was refused and keeps its label", async () => {
  duplicateStatus = 400;
  jest.spyOn(console, "error").mockImplementation(() => {});
  fireEvent.focus(await pickOwner());
  fireEvent.click(await screen.findByRole("button", { name: "Call your rep" }));
  fireEvent.change(screen.getByPlaceholderText(/label/i), {
    target: { value: "Flyer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create duplicate" }));

  expect(await screen.findByText("That action is archived")).toBeTruthy();
  expect(screen.getByDisplayValue("Flyer")).toBeTruthy();
});

it("says when it cannot delete a link and keeps it", async () => {
  deleteStatus = 500;
  userLinks = [shareLink("a", "Newsletter")];
  jest.spyOn(console, "error").mockImplementation(() => {});
  await pickOwner();
  await screen.findByText("Newsletter");
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

  expect(await screen.findByText("Failed to delete share link.")).toBeTruthy();
  expect(screen.getByText("Newsletter")).toBeTruthy();
});
