import type {
  ContractEventDto,
  TagDto,
  UserActionRelationsResponseDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import {
  makeProfile,
  makeTag,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import UsersList from "./UsersList";

export const signed: ContractEventDto = {
  type: "signed",
  date: "2026-01-01T00:00:00.000Z",
  automatic: false,
  contractId: null,
};

export const ada = makeUser({
  id: 1,
  name: "Ada",
  email: "first@example.com",
  admin: true,
  lastContractEvent: signed,
});
export const sam = makeUser({
  id: 2,
  name: "Sam",
  email: "sam@example.com",
  staff: true,
  phoneNumber: "+1 (555) 010-2000",
  lastContractEvent: signed,
});
export const lee = makeUser({
  id: 3,
  name: "Lee",
  email: "lee@example.org",
  staff: true,
  lastContractEvent: signed,
});

/** One current member action, which only Sam has completed. */
const relations: UserActionRelationsResponseDto = {
  actions: [
    {
      id: 1,
      name: "Call your representative",
      status: "member_action",
      weekNumber: 1,
      allMembersParticipating: true,
      memberActionDeadline: null,
    },
  ],
  suites: [],
  users: [
    { userId: sam.id, relations: [{ actionId: 1, status: "completed" }] },
  ],
};

type ApiState = {
  users: UserDto[];
  tags: TagDto[];
  tagsStatus: number;
  addUserStatus: number;
  timeSpentTotal: () => Response;
  usersStatus: number;
  relationsStatus: number;
  relationsGate: Promise<void>;
  tagsGate: Promise<void>;
  tagCalls: { path: string; body: unknown }[];
  /** The rendered page's search string. */
  location: string;
};

const initialState = (): ApiState => ({
  users: [ada, sam, lee],
  tags: [
    makeTag({ id: "t1", name: "Volunteers", users: [makeProfile(lee.id)] }),
    makeTag({ id: "t2", name: "Donors", users: [makeProfile(sam.id)] }),
  ],
  tagsStatus: 200,
  addUserStatus: 200,
  timeSpentTotal: () => Response.json([]),
  usersStatus: 200,
  relationsStatus: 200,
  relationsGate: Promise.resolve(),
  tagsGate: Promise.resolve(),
  tagCalls: [],
  location: "",
});

/** What the served API answers; reset before each test. */
export const api: ApiState = initialState();

/** Serves the members list's API from `api` for every test in the file. */
export function serveUsersListApi() {
  serveApi(
    routes({
      "GET /user/list": () =>
        api.usersStatus === 200
          ? Response.json(api.users)
          : Response.json({}, { status: api.usersStatus }),
      "GET /analytics/time-spent-per-user-total": () => api.timeSpentTotal(),
      "GET /user/tags": async () => {
        await api.tagsGate;
        return api.tagsStatus === 200
          ? Response.json(api.tags)
          : Response.json({}, { status: api.tagsStatus });
      },
      "GET /actions/action-relations": async () => {
        await api.relationsGate;
        return api.relationsStatus === 200
          ? Response.json(relations)
          : Response.json({}, { status: api.relationsStatus });
      },
      "GET /community/memberContactInfo": () => Response.json([]),
      "POST /user/tags/:tagId/addUser": async ({ request, params }) => {
        if (api.addUserStatus !== 200) {
          return Response.json({}, { status: api.addUserStatus });
        }
        api.tagCalls.push({
          path: `${params.tagId}/addUser`,
          body: await request.json(),
        });
        return Response.json({});
      },
      "POST /user/tags/:tagId/removeUser": async ({ request, params }) => {
        api.tagCalls.push({
          path: `${params.tagId}/removeUser`,
          body: await request.json(),
        });
        return Response.json({});
      },
    }),
  );

  beforeEach(() => {
    Object.assign(api, initialState());
  });
}

export const renderPage = (search = "?view=grid", query = queryWrapper()) => {
  const router = createMemoryRouter(
    [
      {
        path: "/members",
        Component: () => {
          api.location = useLocation().search;
          return <UsersList />;
        },
      },
    ],
    { initialEntries: [`/members${search}`] },
  );
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
};

export const shownNames = () =>
  screen
    .queryAllByRole("link")
    .map((link) => link.textContent)
    .filter((text) => api.users.some((user) => user.name === text));

export const openFilters = async () => {
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.findByRole("dialog");
};

export const check = async (group: string, option: RegExp) => {
  const popup = screen.queryByRole("dialog") ?? (await openFilters());
  fireEvent.click(
    within(within(popup).getByRole("group", { name: group })).getByRole(
      "checkbox",
      { name: option },
    ),
  );
};

export const chips = () =>
  within(screen.getByRole("list", { name: "Active filters" }))
    .getAllByRole("listitem")
    .map((chip) => chip.textContent);

export const search = (query: string) =>
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Search by name, email or phone" }),
    { target: { value: query } },
  );
