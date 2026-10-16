import type { CommunityDto } from "@alliance/shared/client";
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

export const me = makeProfile(testAuthUser.id);
export const ledGroup = makeCommunity({
  id: 7,
  name: "Ada's group",
  leaders: [me],
});
export const memberGroup = makeCommunity({
  id: 9,
  name: "Bo's group",
  leaders: [makeProfile(2)],
  users: [makeProfile(2), me],
  maxCapacity: 4,
});

export const reusableLink = makeShareUrlMine({
  label: "Book club",
  assignmentKind: "community",
  communityId: 7,
  communityName: "Ada's group",
});

interface InviteFormApi {
  myCommunities: CommunityDto[];
  groupLoads: number;
  onetimeInviteStatus: number;
  onetimeInviteRefusal: object;
  createHeld: Promise<void>;
  reusableInviteStatus: number;
  onetimeBodies: unknown[];
  reusableBodies: unknown[];
  communityBodies: unknown[];
  communityRefusal: { status: number; message: string } | null;
  communityUnreachable: boolean;
  copied: string[];
}

const freshApi = (): InviteFormApi => ({
  myCommunities: [ledGroup],
  groupLoads: 0,
  onetimeInviteStatus: 200,
  onetimeInviteRefusal: {},
  createHeld: Promise.resolve(),
  reusableInviteStatus: 200,
  onetimeBodies: [],
  reusableBodies: [],
  communityBodies: [],
  communityRefusal: null,
  communityUnreachable: false,
  copied: [],
});

/** Serves InviteForm's endpoints for every test in the calling file, and
 * returns the state they answer from, reset before each test. Call at file
 * scope. */
export const serveInviteForm = () => {
  const api = freshApi();

  serveApi(
    routes({
      "GET /community/list/my": () => {
        api.groupLoads += 1;
        return Response.json(api.myCommunities);
      },
      "POST /user/onetimeInvite/create": async ({ request }) => {
        api.onetimeBodies.push(await request.json());
        await api.createHeld;
        return api.onetimeInviteStatus === 200
          ? Response.json(makeOnetimeInvite())
          : Response.json(api.onetimeInviteRefusal, {
              status: api.onetimeInviteStatus,
            });
      },
      "POST /share-urls/mine/invite-duplicate": async ({ request }) => {
        api.reusableBodies.push(await request.json());
        await api.createHeld;
        return api.reusableInviteStatus === 200
          ? Response.json(reusableLink)
          : Response.json({}, { status: api.reusableInviteStatus });
      },
      "GET /share-urls/mine/invites": () => Response.json([reusableLink]),
      "GET /user/onetimeInvites/overview": () => Response.json([]),
      "POST /community/create": async ({ request }) => {
        api.communityBodies.push(await request.json());
        await api.createHeld;
        if (api.communityUnreachable) throw new TypeError("Failed to fetch");
        if (api.communityRefusal !== null) {
          const { status, message } = api.communityRefusal;
          return Response.json({ message, statusCode: status }, { status });
        }
        const created = makeCommunity({
          id: 11,
          name: "First's Group",
          leaders: [me],
        });
        api.myCommunities = [...api.myCommunities, created];
        return Response.json(created);
      },
    }),
  );

  beforeEach(() => {
    process.env.VITE_ALT_APP_URL = "https://example.com";
    Object.assign(api, freshApi());
    jest
      .spyOn(navigator.clipboard, "write")
      .mockImplementation(async ([item]) => {
        api.copied.push(await (await item.getType("text/plain")).text());
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
        expect(api.groupLoads).toBeGreaterThan(0);
        expect(client.isFetching()).toBe(0);
      });
    return { client, onInviteCreated, onReusableInviteCreated, groupsLoaded };
  };

  return { api, renderForm };
};

export const button = (name: string) => screen.getByRole("button", { name });

export enum InviteType {
  Single = "One person",
  Multi = "Many people",
}

export const enterSingleUseName = (name: string) =>
  enterName(InviteType.Single, name);

export const enterName = (inviteType: InviteType, name: string) => {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(inviteType) }));
  fireEvent.click(button("Next"));
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
  screen.getByText("Which group should they join?");
};
