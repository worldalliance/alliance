import type { CommunityDto } from "@alliance/shared/client";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeOnetimeInvite,
  makeProfile,
  makeShareUrlMine,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import InviteForm from "./InviteForm";

const me = makeProfile(testAuthUser.id);
const ledGroup = makeCommunity({ id: 7, name: "Ada's group", leaders: [me] });
const memberGroup = makeCommunity({
  id: 9,
  name: "Bo's group",
  leaders: [makeProfile(2)],
  users: [makeProfile(2), me],
  maxCapacity: 4,
});

const reusableLink = makeShareUrlMine({
  label: "Book club",
  assignmentKind: "community",
  communityId: 7,
  communityName: "Ada's group",
});

let myCommunities: CommunityDto[];
let groupLoads: number;
let onetimeInviteStatus: number;
let onetimeInviteRefusal: object;
let createHeld: Promise<void>;
let reusableInviteStatus: number;
let onetimeBodies: unknown[];
let reusableBodies: unknown[];
let communityBodies: unknown[];
let copied: string[];

serveApi(
  routes({
    "GET /community/list/my": () => {
      groupLoads += 1;
      return Response.json(myCommunities);
    },
    "POST /user/onetimeInvite/create": async ({ request }) => {
      onetimeBodies.push(await request.json());
      await createHeld;
      return onetimeInviteStatus === 200
        ? Response.json(makeOnetimeInvite())
        : Response.json(onetimeInviteRefusal, { status: onetimeInviteStatus });
    },
    "POST /share-urls/mine/invite-duplicate": async ({ request }) => {
      reusableBodies.push(await request.json());
      await createHeld;
      return reusableInviteStatus === 200
        ? Response.json(reusableLink)
        : Response.json({}, { status: reusableInviteStatus });
    },
    "GET /share-urls/mine/invites": () => Response.json([reusableLink]),
    "GET /user/onetimeInvites/overview": () => Response.json([]),
    "POST /community/create": async ({ request }) => {
      communityBodies.push(await request.json());
      await createHeld;
      const created = makeCommunity({
        id: 11,
        name: "First's Group",
        leaders: [me],
      });
      myCommunities = [...myCommunities, created];
      return Response.json(created);
    },
  }),
);

beforeEach(() => {
  process.env.VITE_ALT_APP_URL = "https://example.com";
  myCommunities = [ledGroup];
  groupLoads = 0;
  onetimeInviteStatus = 200;
  onetimeInviteRefusal = {};
  createHeld = Promise.resolve();
  reusableInviteStatus = 200;
  onetimeBodies = [];
  reusableBodies = [];
  communityBodies = [];
  copied = [];
  jest
    .spyOn(navigator.clipboard, "write")
    .mockImplementation(async ([item]) => {
      copied.push(await (await item.getType("text/plain")).text());
    });
});

afterEach(() => {
  cleanup();
  delete process.env.VITE_ALT_APP_URL;
});

const renderForm = () => {
  const onInviteCreated = jest.fn();
  const onReusableInviteCreated = jest.fn();
  const { client, wrapper: QueryWrapper } = queryWrapper();
  render(
    <QueryWrapper>
      <ToastProvider>
        <AuthContext.Provider value={authValue({ user: testAuthUser })}>
          <MemoryRouter>
            <SiteAppProvider>
              <InviteForm
                onInviteCreated={onInviteCreated}
                onReusableInviteCreated={onReusableInviteCreated}
              />
            </SiteAppProvider>
          </MemoryRouter>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryWrapper>,
  );
  const groupsLoaded = () =>
    waitFor(() => {
      expect(groupLoads).toBeGreaterThan(0);
      expect(client.isFetching()).toBe(0);
    });
  return { client, onInviteCreated, onReusableInviteCreated, groupsLoaded };
};

const button = (name: string) => screen.getByRole("button", { name });

enum InviteType {
  Single = "One person",
  Multi = "Many people",
}

const createButton: Record<InviteType, string> = {
  [InviteType.Single]: "Copy new invite link",
  [InviteType.Multi]: "Create invite link",
};

const enterSingleUseName = (name: string) => enterName(InviteType.Single, name);

const enterName = (inviteType: InviteType, name: string) => {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(inviteType) }));
  fireEvent.click(button("Next"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
  screen.getByText("Which group should they join?");
};

const ledGroupPicked = () =>
  waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Ada's group" })).toHaveLength(
      2,
    ),
  );

const pickPlacement = (option: string) => {
  const [toggleOrOption, maybeOption] = screen.getAllByRole("button", {
    name: option,
  });
  fireEvent.click(maybeOption ?? toggleOrOption);
};

it("walks the steps, holding Next until the invitee has a name", () => {
  renderForm();
  expect(screen.getByLabelText("Step 1 of 3")).toBeDefined();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

  fireEvent.click(button("Next"));
  screen.getByText("Invite an individual");
  expect(screen.getByLabelText("Step 2 of 3")).toBeDefined();
  expect(button("Next").hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByPlaceholderText("Name of the invitee"), {
    target: { value: "  " },
  });
  expect(button("Next").hasAttribute("disabled")).toBe(true);
  expect(
    screen
      .getByRole("link", { name: "Preview invite link" })
      .getAttribute("href"),
  ).toBe("https://example.com/signup?ref=1234567890&preview=1");

  fireEvent.change(screen.getByPlaceholderText("Name of the invitee"), {
    target: { value: "Sam" },
  });
  fireEvent.click(button("Next"));
  screen.getByText("Which group should they join?");

  fireEvent.click(button("Back"));
  expect(
    screen.getByPlaceholderText<HTMLInputElement>("Name of the invitee").value,
  ).toBe("Sam");
});

it("clears the name when the invite type changes", () => {
  renderForm();
  fireEvent.click(button("Next"));
  fireEvent.change(screen.getByPlaceholderText("Name of the invitee"), {
    target: { value: "Sam" },
  });

  fireEvent.click(button("Back"));
  fireEvent.click(screen.getByRole("radio", { name: /Many people/ }));
  fireEvent.click(button("Next"));
  expect(
    screen.getByPlaceholderText<HTMLInputElement>(
      "Name of the group you are inviting",
    ).value,
  ).toBe("");
});

it.each([
  {
    creating: "a single-use invite",
    inviteType: InviteType.Single,
    leadsAGroup: true,
    create: createButton[InviteType.Single],
    busy: "Creating invite...",
    sent: () => onetimeBodies,
  },
  {
    creating: "a multi-use link",
    inviteType: InviteType.Multi,
    leadsAGroup: true,
    create: createButton[InviteType.Multi],
    busy: "Creating invite...",
    sent: () => reusableBodies,
  },
  {
    creating: "a new group",
    inviteType: InviteType.Single,
    leadsAGroup: false,
    create: "Create group and invite",
    busy: "Creating...",
    sent: () => communityBodies,
  },
])(
  "holds the wizard while $creating is being created",
  async ({ inviteType, leadsAGroup, create, busy, sent }) => {
    myCommunities = leadsAGroup ? [ledGroup] : [];
    const held = Promise.withResolvers<void>();
    createHeld = held.promise;
    const { groupsLoaded } = renderForm();
    enterName(inviteType, "Sam");
    await (leadsAGroup ? ledGroupPicked() : groupsLoaded());

    fireEvent.click(button(create));
    await waitFor(() => expect(sent()).toHaveLength(1));
    expect(
      (await screen.findByRole("button", { name: busy })).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
    expect(button("Back").hasAttribute("disabled")).toBe(true);
    fireEvent.click(button(busy));

    held.resolve();
    await screen.findByText(/created and copied to clipboard!$/);
    expect(sent()).toHaveLength(1);
  },
);

it("creates a single-use invite into the group the user leads, then starts over", async () => {
  const { client, onInviteCreated } = renderForm();
  enterSingleUseName("  Sam ");
  await ledGroupPicked();
  screen.getByText(
    onetimeInviteCreation.responsible.leader.invite.explanation.join("\n\n"),
  );

  fireEvent.click(button("Copy new invite link"));

  await screen.findByText("Invite created and copied to clipboard!");
  expect(onetimeBodies).toEqual([{ invitee: "Sam", communityId: 7 }]);
  expect(copied).toEqual(["https://example.com/signup?ref=abc123"]);
  expect(onInviteCreated).toHaveBeenCalled();
  expect(client.getQueryData(queryKeys.onetimeInvitesOverview())).toEqual([
    makeOnetimeInvite(),
  ]);
  screen.getByText("Who are you inviting?");
});

it("invites into another group the user leads when they pick it", async () => {
  myCommunities = [
    ledGroup,
    makeCommunity({ id: 8, name: "Cy's group", leaders: [me] }),
  ];
  renderForm();
  enterSingleUseName("Sam");
  await ledGroupPicked();

  pickPlacement("Cy's group");
  fireEvent.click(button("Copy new invite link"));

  await screen.findByText("Invite created and copied to clipboard!");
  expect(onetimeBodies).toEqual([{ invitee: "Sam", communityId: 8 }]);
});

it.each([
  ["single-use", InviteType.Single, /^Failed to create invite: /],
  ["multi-use", InviteType.Multi, /^Failed to create invite link: /],
])(
  "keeps the group step when the server refuses a %s invite",
  async (_, inviteType, failure) => {
    onetimeInviteStatus = 500;
    reusableInviteStatus = 500;
    const callbacks = renderForm();
    enterName(inviteType, "Sam");
    await ledGroupPicked();

    fireEvent.click(button(createButton[inviteType]));

    await screen.findByText(failure);
    expect(callbacks.onInviteCreated).not.toHaveBeenCalled();
    expect(callbacks.onReusableInviteCreated).not.toHaveBeenCalled();
    screen.getByText("Which group should they join?");
  },
);

it.each([
  [{ message: "Invitee is too long" }, "Invitee is too long"],
  [{}, "Unknown error"],
])(
  "says why the server refused a single-use invite",
  async (refusal, reason) => {
    onetimeInviteStatus = 400;
    onetimeInviteRefusal = refusal;
    renderForm();
    enterSingleUseName("Sam");
    await ledGroupPicked();

    fireEvent.click(button(createButton[InviteType.Single]));

    await screen.findByText(`Failed to create invite: ${reason}`);
  },
);

it.each([
  [
    "single-use",
    InviteType.Single,
    "Invite created, but it could not be copied to the clipboard.",
    "onInviteCreated",
  ],
  [
    "multi-use",
    InviteType.Multi,
    "Invite link created, but it could not be copied to the clipboard.",
    "onReusableInviteCreated",
  ],
] as const)(
  "says so when a %s invite is created but the clipboard refuses it",
  async (_, inviteType, notCopied, callback) => {
    jest.spyOn(navigator.clipboard, "write").mockRejectedValue(new Error());
    jest.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error());
    const callbacks = renderForm();
    enterName(inviteType, "Sam");
    await ledGroupPicked();

    fireEvent.click(button(createButton[inviteType]));

    await screen.findByText(notCopied);
    expect(callbacks[callback]).toHaveBeenCalled();
    screen.getByText("Who are you inviting?");
  },
);

it("creates a multi-use link labeled with the group's name", async () => {
  const { onReusableInviteCreated } = renderForm();
  fireEvent.click(screen.getByRole("radio", { name: /Many people/ }));
  fireEvent.click(button("Next"));
  screen.getByText("Invite a group");
  fireEvent.change(
    screen.getByPlaceholderText("Name of the group you are inviting"),
    { target: { value: "  Book club " } },
  );
  fireEvent.click(button("Next"));
  await ledGroupPicked();

  fireEvent.click(button("Create invite link"));

  await screen.findByText("Invite link created and copied to clipboard!");
  expect(reusableBodies).toEqual([{ label: "Book club", communityId: 7 }]);
  expect(copied).toEqual([reusableLink.url]);
  expect(onReusableInviteCreated).toHaveBeenCalled();
  screen.getByText("Who are you inviting?");
});

it("assigns to any open group, showing the user's own group and its open seats", async () => {
  myCommunities = [ledGroup, memberGroup];
  renderForm();
  enterSingleUseName("Sam");
  await ledGroupPicked();

  pickPlacement("Assign them to any open group");

  screen.getByText("Your current group");
  screen.getByText("Bo's group");
  screen.getByText("3 open seats");
  expect(
    screen
      .getByRole("link", { name: "Open Bo's group in a new tab" })
      .getAttribute("href"),
  ).toBe("/groups?communityId=9");
  fireEvent.click(button("Copy new invite link"));
  await screen.findByText("Invite created and copied to clipboard!");
  expect(onetimeBodies).toEqual([{ invitee: "Sam" }]);
});

it.each([
  ["takes no member invites", { allowMemberInvites: false }],
  ["has no capacity limit", { maxCapacity: null }],
])(
  "explains the generic placement when the user's own group %s",
  async (_, override) => {
    myCommunities = [ledGroup, { ...memberGroup, ...override }];
    renderForm();
    enterSingleUseName("Sam");
    await ledGroupPicked();

    pickPlacement("Assign them to any open group");

    screen.getByText(
      onetimeInviteCreation.not_responsible.explanations.genericGroup.join(
        "\n\n",
      ),
    );
    expect(screen.queryByText("Your current group")).toBeNull();
    fireEvent.click(button("Copy new invite link"));
    await screen.findByText("Invite created and copied to clipboard!");
    expect(onetimeBodies).toEqual([{ invitee: "Sam" }]);
  },
);

it("says when the user's own group is full", async () => {
  myCommunities = [ledGroup, { ...memberGroup, maxCapacity: 1 }];
  renderForm();
  enterSingleUseName("Sam");
  await ledGroupPicked();

  pickPlacement("Assign them to any open group");

  screen.getByText(
    "Your group is full, so they will be assigned elsewhere after they sign up.",
  );
  expect(screen.queryByText("Your current group")).toBeNull();
});

it("creates a group for a user leading none, invites into it, then picks it for the next invite", async () => {
  myCommunities = [memberGroup];
  const { onInviteCreated, groupsLoaded } = renderForm();
  enterSingleUseName("Sam");
  await groupsLoaded();
  screen.getByText(
    "You are not leading a group yet—create one to be responsible for this member.",
  );

  fireEvent.click(button("Create group and invite"));

  await screen.findByText("Invite created and copied to clipboard!");
  expect(communityBodies).toHaveLength(1);
  expect(onetimeBodies).toEqual([{ invitee: "Sam", communityId: 11 }]);
  expect(onInviteCreated).toHaveBeenCalled();
  screen.getByText("Who are you inviting?");

  enterSingleUseName("Kim");
  await waitFor(() =>
    expect(button("Copy new invite link").hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(button("Copy new invite link"));
  await waitFor(() => expect(onetimeBodies).toHaveLength(2));
  expect(onetimeBodies[1]).toEqual({ invitee: "Kim", communityId: 11 });
  await screen.findByText("Who are you inviting?");
});

it("creates a group, then a multi-use link into it", async () => {
  myCommunities = [];
  const { onReusableInviteCreated, groupsLoaded } = renderForm();
  enterName(InviteType.Multi, "Book club");
  await groupsLoaded();

  fireEvent.click(button("Create group and invite"));

  await screen.findByText("Invite link created and copied to clipboard!");
  expect(communityBodies).toHaveLength(1);
  expect(reusableBodies).toEqual([{ label: "Book club", communityId: 11 }]);
  expect(onReusableInviteCreated).toHaveBeenCalled();
});

it("selects a created group even when the invite into it is refused", async () => {
  myCommunities = [];
  onetimeInviteStatus = 500;
  const { onInviteCreated, groupsLoaded } = renderForm();
  enterSingleUseName("Sam");
  await groupsLoaded();

  fireEvent.click(button("Create group and invite"));

  await screen.findByText(/^Failed to create invite: /);
  expect(onInviteCreated).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "First's Group" }),
    ).toHaveLength(2),
  );
  screen.getByText("Which group should they join?");
});
