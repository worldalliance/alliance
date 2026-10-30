import type { CohortExpression } from "@alliance/common/cohort-expression";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
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

const foodDrive = (): ProjectDto | null => ({
  id: 4,
  name: "Food drive",
  category: [],
});

export const manual = (userIds: number[]): CohortExpression => ({
  type: "Manual",
  userIds,
});

const adminAction = (params: {
  id: number;
  name: string;
  timeEstimate: number;
  body: string;
  memberIds: number[];
  taskFormId?: number | null;
}) => ({
  ...makeAction({ id: params.id, name: params.name }),
  shortDescription: "Short.",
  body: params.body,
  timeEstimate: params.timeEstimate,
  suite: { id: 3, name: "Spring suite" },
  project: foodDrive(),
  authors: [makeProfile(1)],
  taskFormId: params.taskFormId === undefined ? 5 : params.taskFormId,
  cohortExpression: manual(params.memberIds),
  prerequisiteActionIds: [],
});

const initialState = () => ({
  benSigned: true,
  formPages: [] as { id: string; title: string; fields: [] }[],
  /** Pages served for a form id instead of `formPages`. */
  formPagesById: {} as Record<
    number,
    {
      id: string;
      title: string;
      fields: [];
      visibleIfFormula?: VisibleIfFormula;
    }[]
  >,
  visibilityProfileRequests: [] as { userIds: number[] }[],
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
        Number.isInteger(Number(params.id))
          ? Response.json({
              id: 5,
              title: "Form",
              schema: {
                pages: api.formPagesById[Number(params.id)] ?? api.formPages,
                outputViews: [],
              },
            })
          : Response.json({ statusCode: 400 }, { status: 400 }),
      "POST /actions/evaluate-cohort": async ({ request }) => {
        const { expression }: { expression: { userIds?: number[] } } =
          await request.json();
        return Response.json({ userIds: expression.userIds ?? [] });
      },
      "POST /tasks/visibilityProfiles": async ({ request }) => {
        const { userIds }: { userIds: number[] } = await request.json();
        api.visibilityProfileRequests.push({ userIds });
        return Response.json({
          profiles: userIds.map((userId) => ({
            results: [userId === 10],
            userIds: [userId],
          })),
        });
      },
      "GET /user/:id/visibilitycontext": ({ params }) =>
        Response.json({
          userHasCity: params.id === "10",
          userPropertyHasValue: {},
          firstContractSignedAt: null,
          completedActionCount: 0,
        }),
      "GET /user/list": () =>
        Response.json([
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

export const renderPanel = () => {
  const addEvent = (body: CreateActionEventDto) =>
    actionSuitesAddSuiteEventAdmin({
      path: { suiteId: 3 },
      body,
      throwOnError: true,
    }).then((res) => res.data);
  const query = queryWrapper();
  // The dictionary loads through Vite's `?raw` imports, which bun can't resolve.
  query.client.setQueryData(
    spellcheckerQuery.queryKey,
    () => (word: string) => word !== "teh",
  );
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
