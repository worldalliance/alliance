import type {
  CreateActionActivityDto,
  FormResponseDto,
  NotificationSettingsAdminDto,
  UserActionRelationsResponseDto,
  UserAdminDetailDto,
  UserAwayRangeDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeProfile,
  makeTag,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { omit } from "es-toolkit";
import { createMemoryRouter, RouterProvider } from "react-router";
import { AuthProvider } from "../lib/AuthContext";
import UserDetailView, { clientLoader } from "./UserDetailView";

export const sam: UserAdminDetailDto = {
  ...makeUser({ id: 7, name: "Sam", hasActiveContract: true }),
  communities: [],
  tags: [],
  location: {},
  invitedBy: null,
};

export const alex = {
  ...makeProfile(8),
  displayName: "Alex",
  ambassador: true,
};

const tagDto = makeTag();
export const volunteers = omit(tagDto, ["users"]);

export const relationsFor = (
  status: "todo" | "completed",
): UserActionRelationsResponseDto => ({
  actions: [
    {
      id: 5,
      name: "Call your representative",
      status: "member_action",
      weekNumber: 1,
      allMembersParticipating: false,
      memberActionDeadline: null,
    },
  ],
  suites: [],
  users: [{ userId: 7, relations: [{ actionId: 5, status }] }],
});

type ApiState = {
  stored: UserAdminDetailDto;
  notificationSettings: NotificationSettingsAdminDto | null;
  detailStatus: number;
  addTagStatus: number;
  relations: UserActionRelationsResponseDto;
  relationsStatus: number;
  tagSummariesStatus: number;
  friendsStatus: number;
  formResponses: FormResponseDto[];
  notifsStatus: number;
  formResponsesStatus: number;
  createdActivities: CreateActionActivityDto[];
  detailGate: Promise<void> | null;
  awayRanges: UserAwayRangeDto[] | null;
};

const initialState = (): ApiState => ({
  stored: sam,
  notificationSettings: null,
  detailStatus: 404,
  addTagStatus: 200,
  relations: { actions: [], suites: [], users: [] },
  relationsStatus: 200,
  tagSummariesStatus: 200,
  friendsStatus: 200,
  formResponses: [],
  notifsStatus: 200,
  formResponsesStatus: 200,
  createdActivities: [],
  detailGate: null,
  awayRanges: null,
});

/** What the served API answers; reset before each test. */
export const api: ApiState = initialState();

/** Serves the member page's API from `api` for every test in the file. */
export function serveUserDetailApi() {
  serveApi(
    routes(
      {
        "GET /user/userdetail/:id": async () => {
          await api.detailGate;
          return api.detailStatus === 200
            ? Response.json(api.stored)
            : Response.json(
                { message: "User not found" },
                { status: api.detailStatus },
              );
        },
        "GET /user/userdetail/:id/notification-settings": () =>
          api.notificationSettings
            ? Response.json(api.notificationSettings)
            : Response.json({}, { status: 500 }),
        "PATCH /user/userdetail/:id/roles": () =>
          Response.json({ message: "Forbidden" }, { status: 400 }),
        "POST /contract/admin/suspend/:userId": () =>
          Response.json(
            { message: "Member does not have an active contract." },
            { status: 400 },
          ),
        "GET /user/tag-summaries": () =>
          api.tagSummariesStatus === 200
            ? Response.json([volunteers])
            : Response.json({}, { status: api.tagSummariesStatus }),
        "POST /user/tags/:tagId/addUser": () => {
          if (api.addTagStatus !== 200) {
            return Response.json(
              { message: "Tag is archived" },
              { status: api.addTagStatus },
            );
          }
          api.stored = { ...api.stored, tags: [volunteers] };
          return Response.json(tagDto);
        },
        "GET /actions/action-relations/:userId": () =>
          api.relationsStatus === 200
            ? Response.json(api.relations)
            : Response.json({}, { status: api.relationsStatus }),
        "POST /actions/createActivity": async ({ request }) => {
          const body: CreateActionActivityDto = await request.json();
          api.createdActivities.push(body);
          api.relations = relationsFor("completed");
          return Response.json({});
        },
        "GET /notifs/for-user/:id": () =>
          api.notifsStatus === 200
            ? Response.json([])
            : Response.json({}, { status: api.notifsStatus }),
        "POST /tasks/formsForUserSID/:userId": () =>
          api.formResponsesStatus === 200
            ? Response.json(api.formResponses)
            : Response.json({}, { status: api.formResponsesStatus }),
        "GET /mms-threads/:userId": () =>
          Response.json({
            phoneNumber: "+14155550123",
            textable: true,
            optedOut: false,
            replyState: "answered",
            messages: [],
          }),
        "GET /user/awayranges/:id": () =>
          api.awayRanges
            ? Response.json(api.awayRanges)
            : Response.json({}, { status: 404 }),
        "GET /user/listfriends/:id": () =>
          api.friendsStatus === 200
            ? Response.json([alex])
            : Response.json({}, { status: api.friendsStatus }),
      },
      // The sections a loaded member renders load their own data.
      () => Response.json({}, { status: 404 }),
    ),
  );

  beforeAll(() => queryClient.setDefaultOptions({ queries: { retry: false } }));

  beforeEach(() => {
    Object.assign(api, initialState());
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
  });
}

export const renderPage = (search = "") => {
  const router = createMemoryRouter(
    [
      {
        path: "/member/:userId",
        Component: UserDetailView,
        loader: (args) =>
          clientLoader({
            ...args,
            params: { userId: args.params.userId ?? "" },
          }),
      },
    ],
    { initialEntries: [`/member/7${search}`] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

export const cacheSam = (overrides: Partial<UserAdminDetailDto> = {}) =>
  queryClient.setQueryData(queryKeys.userDetailAdmin(7), {
    ...sam,
    ...overrides,
  });
