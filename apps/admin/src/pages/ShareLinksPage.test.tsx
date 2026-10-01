import type {
  CampaignDto,
  ExternalShareTargetDto,
  ProfileDto,
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

let actionsStatus = 200;
let targetsStatus = 200;
let actionsGate = Promise.resolve();
let targetsGate = Promise.resolve();

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
      Response.json([
        {
          id: 7,
          name: "Spring fundraiser",
          code: "spring7",
          picture: null,
          createdAt: "2026-01-02T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        } satisfies CampaignDto,
      ]),
    "GET /share-urls/for-user/:userId": () => Response.json([]),
    "GET /share-urls/for-campaign/:campaignId": () => Response.json([]),
    "GET /user/members": () =>
      Response.json([
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
  actionsGate = Promise.resolve();
  targetsGate = Promise.resolve();
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

it("gives a campaign's signup link on the invite domain", async () => {
  jest
    .spyOn(config, "getInviteBaseUrl")
    .mockReturnValue("https://test.alliance/");
  render(
    <ToastProvider>
      <ShareLinksPage />
    </ToastProvider>,
    queryWrapper(),
  );
  fireEvent.change(screen.getByDisplayValue("User"), {
    target: { value: "campaign" },
  });
  await screen.findByRole("option", { name: "Spring fundraiser" });
  fireEvent.change(screen.getByDisplayValue("Select a campaign…"), {
    target: { value: "7" },
  });

  expect(
    await screen.findByText("https://test.alliance/signup?ref=spring7"),
  ).toBeTruthy();
});
