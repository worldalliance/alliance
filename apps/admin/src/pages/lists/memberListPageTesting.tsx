import type {
  FormulaDto,
  FormulaProblemDto,
  MemberListDto,
  SaveFormulasDto,
  SaveMemberListDto,
  UpdateMemberListDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import MemberListPage from "./MemberListPage";

export const volunteers: MemberListDto = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Volunteers",
  versionId: 5,
  userIds: [7],
};
export const onVolunteers: FormulaDto = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "onVolunteers",
  text: 'isOnList("Volunteers")',
  notes: null,
  versionId: 9,
  reads: [],
  updatedAt: "2026-11-19T00:00:00.000Z",
};
export const readsVolunteers: FormulaProblemDto = {
  kind: "named",
  id: onVolunteers.id,
  text: 'isOnList("Volunteers")',
  diagnostics: [
    {
      message: "This uses a list that no longer exists.",
      start: 0,
      end: 22,
    },
  ],
};
const users = [
  { id: 7, name: "Ana", email: "ana@example.com", profilePicture: null },
  { id: 12, name: "Bo", email: "bo@example.com", profilePicture: null },
];

export const partReadsVolunteers: FormulaProblemDto = {
  ...readsVolunteers,
  kind: "dependent",
  id: "partition:4:part-1",
  partition: {
    suiteId: 4,
    suiteName: "Week 12",
    versionId: 2,
    partId: "part-1",
    partName: "Listed",
    fallback: null,
  },
};

type MemberListPageApi = {
  lists: MemberListDto[];
  listSaves: (SaveMemberListDto | UpdateMemberListDto)[];
  formulaSaves: SaveFormulasDto[];
  formulaAnswers: FormulaProblemDto[][];
  updateStatus: number;
  updateHeld: Promise<void>;
  usersStatus: number;
  usersHeld: Promise<void>;
  formulasHeld: Promise<void>;
  formulaSaveHeld: Promise<void>;
};

const fresh = (): MemberListPageApi => ({
  lists: [volunteers],
  listSaves: [],
  formulaSaves: [],
  formulaAnswers: [],
  updateStatus: 200,
  updateHeld: Promise.resolve(),
  usersStatus: 200,
  usersHeld: Promise.resolve(),
  formulasHeld: Promise.resolve(),
  formulaSaveHeld: Promise.resolve(),
});

export const api = fresh();

/** Each test file calls this: the module loads once per run, so top-level hooks would attach to the first file only. */
export const serveMemberListPageApi = () => {
  serveApi(
    routes({
      "GET /member-lists": () => Response.json(api.lists),
      "POST /member-lists": async ({ request }) => {
        const body: SaveMemberListDto = await request.json();
        api.listSaves.push(body);
        const created = { ...body, id: volunteers.id, versionId: 1 };
        api.lists = [created];
        return Response.json(created);
      },
      "PUT /member-lists/:id": async ({ request }) => {
        const body: UpdateMemberListDto = await request.json();
        api.listSaves.push(body);
        await api.updateHeld;
        if (api.updateStatus !== 200) {
          return Response.json(
            {
              message:
                "This list changed since you opened it. Reload to see the changes.",
            },
            { status: api.updateStatus },
          );
        }
        const saved = {
          id: volunteers.id,
          name: body.name,
          userIds: body.userIds,
          versionId: 6,
        };
        api.lists = [saved];
        return Response.json(saved);
      },
      "GET /formulas": async () => {
        await api.formulasHeld;
        return Response.json([onVolunteers]);
      },
      "POST /formulas/save": async ({ request }) => {
        api.formulaSaves.push(await request.json());
        await api.formulaSaveHeld;
        return Response.json({ problems: api.formulaAnswers.shift() ?? [] });
      },
      "GET /user/list": async () => {
        await api.usersHeld;
        return api.usersStatus === 200
          ? Response.json(users)
          : Response.json({ message: "Down" }, { status: api.usersStatus });
      },
    }),
  );

  beforeEach(() => Object.assign(api, fresh()));
};

export const renderPage = (path: string, cachedFormulas?: FormulaDto[]) => {
  const router = createMemoryRouter(
    [
      { path: "/members/lists", element: <p>All lists</p> },
      {
        path: "/members/lists/:listId",
        element: (
          <LeaveGuard>
            <MemberListPage />
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  const query = queryWrapper();
  if (cachedFormulas) {
    query.client.setQueryData(queryKeys.formulasAdmin(), cachedFormulas);
  }
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return router;
};

export const remove = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Delete list" }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete list",
    }),
  );
};
