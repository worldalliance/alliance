import type {
  ActionEventNotifDto,
  FormResponseDto,
} from "@alliance/shared/client";
import { makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserNotifsAndFormsAdmin } from "./useUserNotifsAndFormsAdmin";

const userId = 3;

const notif = {
  user: makeProfile(userId),
  sent: true,
  pushes: [],
} satisfies Partial<ActionEventNotifDto>;

const formResponse = {
  id: 11,
  formId: 4,
  createdAt: "2026-10-01T00:00:00.000Z",
} satisfies Partial<FormResponseDto>;

let notifsStatus: number;
let formResponsesStatus: number;
let requested: string[];

serveApi(
  routes({
    "GET /notifs/for-user/:id": ({ params }) => {
      requested.push(`notifs ${params.id}`);
      return notifsStatus === 200
        ? Response.json([notif])
        : Response.json({ message: "Forbidden" }, { status: notifsStatus });
    },
    "POST /tasks/formsForUserSID/:userId": ({ params }) => {
      requested.push(`forms ${params.userId}`);
      return formResponsesStatus === 200
        ? Response.json([formResponse])
        : Response.json(
            { message: "Forbidden" },
            { status: formResponsesStatus },
          );
    },
  }),
);

beforeEach(() => {
  notifsStatus = 200;
  formResponsesStatus = 200;
  requested = [];
});

const renderUserNotifsAndForms = () =>
  renderHook(() => useUserNotifsAndFormsAdmin(userId), queryWrapper());

describe("useUserNotifsAndFormsAdmin", () => {
  it("reads the member's notifications and form submissions", async () => {
    const view = renderUserNotifsAndForms();

    await waitFor(() => {
      expect(view.result.current.notifs.data).toEqual([notif]);
      expect(view.result.current.formResponses.data).toEqual([formResponse]);
    });
    expect([...requested].sort()).toEqual([
      `forms ${userId}`,
      `notifs ${userId}`,
    ]);
  });

  it("surfaces a refused notifications load as an error carrying its status", async () => {
    notifsStatus = 403;

    const view = renderUserNotifsAndForms();

    await waitFor(() => expect(view.result.current.notifs.isError).toBe(true));
    expect(view.result.current.notifs.error).toMatchObject({
      statusCode: 403,
    });
  });

  it("surfaces a refused form submissions load as an error carrying its status", async () => {
    formResponsesStatus = 403;

    const view = renderUserNotifsAndForms();

    await waitFor(() =>
      expect(view.result.current.formResponses.isError).toBe(true),
    );
    expect(view.result.current.formResponses.error).toMatchObject({
      statusCode: 403,
    });
  });
});
