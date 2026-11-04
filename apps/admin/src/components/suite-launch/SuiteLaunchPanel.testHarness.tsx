import type { CohortExpression } from "@alliance/common/cohort-expression";
// eslint-disable-next-line api-client/named-hooks-only -- stands in for the page's addEvent against the mocked API; no query cache holds it
import {
  actionSuitesAddSuiteEventAdmin,
  type ActionEventDto,
  type ActionSuiteDto,
  type CreateActionEventDto,
  type ProjectDto,
} from "@alliance/shared/client";
import { makeAction, makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, mock, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import { spellcheckerQuery } from "./spellchecker";
import SuiteLaunchPanel from "./SuiteLaunchPanel";

export const manual = (userIds: number[]): CohortExpression => ({
  type: "Manual",
  userIds,
});

const adminAction = (params: {
  id: number;
  name: string;
  timeEstimate: number;
  body: string;
  memberIds: number[] | null;
  taskFormId?: number | null;
  image?: string | null;
  project?: ProjectDto | null;
}) => ({
  ...makeAction({ id: params.id, name: params.name }),
  image: params.image === undefined ? "cover.png" : params.image,
  shortDescription: "Short.",
  body: params.body,
  timeEstimate: params.timeEstimate,
  suite: { id: 3, name: "Spring suite" },
  project:
    params.project === undefined
      ? { id: 4, name: "Food drive", category: [] }
      : params.project,
  authors: [makeProfile(1)],
  taskFormId: params.taskFormId === undefined ? 5 : params.taskFormId,
  cohortExpression: params.memberIds && manual(params.memberIds),
  prerequisiteActionIds: [],
  memberActionStart: null as string | null,
});

const initialState = () => ({
  benSigned: true,
  benEverSigned: false,
  userListFails: false,
  awayRanges: [] as { userId: number; fromDay: number; toDay: number }[],
  awayRangesFail: false,
  formLoadFails: false,
  formPages: [] as { id: string; title: string; fields: [] }[],
  /** Pages served for a form id instead of `formPages`. */
  formPagesById: {} as Record<
    number,
    { id: string; title: string; fields: [] }[]
  >,
  formSnapshotIdById: {} as Record<number, number>,
  served: {
    1: adminAction({
      id: 1,
      name: "Call",
      timeEstimate: 10,
      body: "Call  your representative.",
      memberIds: [10, 11],
    }),
    2: adminAction({
      id: 2,
      name: "Write",
      timeEstimate: 8,
      body: "Write teh letter.",
      memberIds: [11],
    }),
  } as Record<number, ReturnType<typeof adminAction>>,
  suiteEvents: [] as ActionEventDto[],
  actionList: [] as unknown[],
  createdEvents: [] as CreateActionEventDto[],
  reminderEventIds: [] as string[],
});

export const api = initialState();

export const serveLaunchApi = () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.assign(api, initialState());
  });
  afterEach(() => setSystemTime());

  serveApi(
    routes({
      "GET /actions/all": () => Response.json(api.actionList),
      "GET /user/tags": () => Response.json([]),
      "GET /actions/adminslug/:id": ({ params }) =>
        Response.json(api.served[Number(params.id)]),
      "GET /tasks/adminForm/:id": ({ params }) =>
        Number.isInteger(Number(params.id)) && !api.formLoadFails
          ? Response.json({
              id: 5,
              title: "Form",
              formSnapshotId: api.formSnapshotIdById[Number(params.id)] ?? 1,
              schema: {
                pages: api.formPagesById[Number(params.id)] ?? api.formPages,
                outputViews: [{ type: "card", id: "card", blocks: [] }],
              },
            })
          : Response.json({ statusCode: 400 }, { status: 400 }),
      "POST /actions/evaluate-cohort": async ({ request }) => {
        const { expression }: { expression: { userIds?: number[] } } =
          await request.json();
        return Response.json({ userIds: expression.userIds ?? [] });
      },
      "GET /user/admin/awayranges": () =>
        api.awayRangesFail
          ? Response.json({ statusCode: 500 }, { status: 500 })
          : Response.json(
              api.awayRanges.map(({ userId, fromDay, toDay }) => ({
                id: userId,
                userId,
                userName: `User ${userId}`,
                startDate: new Date(
                  Date.now() + fromDay * 86_400_000,
                ).toISOString(),
                endDate: new Date(
                  Date.now() + toDay * 86_400_000,
                ).toISOString(),
              })),
            ),
      "GET /user/list": () =>
        api.userListFails
          ? Response.json({ statusCode: 500 }, { status: 500 })
          : Response.json([
              {
                id: 10,
                name: "Ana",
                profilePicture: null,
                hasActiveContract: true,
                timeZone: "America/New_York",
              },
              {
                id: 11,
                name: "Ben",
                profilePicture: null,
                hasActiveContract: api.benSigned,
                ...(api.benEverSigned && {
                  lastContractEvent: {
                    type: "signed",
                    date: "2026-01-01T00:00:00.000Z",
                    automatic: false,
                    contractId: 1,
                  },
                }),
              },
            ]),
      "POST /actions/suite/:suiteId/events": async ({ request }) => {
        const body: CreateActionEventDto = await request.json();
        api.createdEvents.push(body);
        api.suiteEvents = [
          ...api.suiteEvents,
          { ...body, id: 100 + api.suiteEvents.length, suiteManaged: true },
        ];
        return Response.json(suiteWith(api.suiteEvents));
      },
      "POST /actions/events/:eventId/createremindergroup": ({ params }) => {
        api.reminderEventIds.push(params.eventId);
        return Response.json({ id: api.reminderEventIds.length });
      },
    }),
  );
};

const suiteWith = (events: ActionEventDto[]): ActionSuiteDto => ({
  id: 3,
  name: "Spring suite",
  actions: [
    makeAction({ id: 1, name: "Call" }),
    makeAction({ id: 2, name: "Write" }),
  ],
  events,
  reminderGroups: [],
  generalUpdates: [],
});

export const onClose = mock(() => {});

export const renderPanel = ({ dictionaryLoads = false } = {}) => {
  const addEvent = (body: CreateActionEventDto) =>
    actionSuitesAddSuiteEventAdmin({
      path: { suiteId: 3 },
      body,
      throwOnError: true,
    }).then((res) => res.data);
  const query = queryWrapper();
  // The dictionary loads through Vite's `?raw` imports, which bun can't resolve.
  if (dictionaryLoads) {
    void query.client.prefetchQuery({
      queryKey: spellcheckerQuery.queryKey,
      queryFn: () => new Promise<never>(() => {}),
    });
  } else {
    query.client.setQueryData(
      spellcheckerQuery.queryKey,
      () => (word: string) => word !== "teh",
    );
  }
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteLaunchPanel
          suite={suiteWith([])}
          addEvent={addEvent}
          fetchSuite={async () => suiteWith(api.suiteEvents)}
          onClose={onClose}
        />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
};

export const launchButton = () =>
  screen.getByRole("button", { name: /Launch and notify/ });

export const resolveEveryCheck = async () => {
  for (const box of await screen.findAllByRole("checkbox", {
    name: "Ready to launch",
  }))
    fireEvent.click(box);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Launch anyway, breaking the contract",
    }),
  );
  for (const dismiss of screen.getAllByRole("button", { name: "Dismiss" }))
    fireEvent.click(dismiss);
};
