import type { AmbassadorProgramDashboardDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useAmbassadorProgramAdmin,
  useCreateAmbassadorProgramInteractionAdmin,
  useUpdateAmbassadorProgramMemberAdmin,
  useUpsertAmbassadorProgramMemberAdmin,
} from "./useAmbassadorProgramAdmin";

afterEach(cleanup);

const dashboard = {
  members: [],
  projection: { generatedAt: "2026-10-05T00:00:00.000Z", points: [] },
} satisfies AmbassadorProgramDashboardDto;

const requests: unknown[] = [];
let writeStatus = 200;

const write =
  (path: string) =>
  async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, string>;
  }) => {
    requests.push({ path, ...params, ...(await request.json()) });
    return Response.json({}, { status: writeStatus });
  };

serveApi(
  routes({
    "GET /user/ambassadorProgram": () => Response.json(dashboard),
    "POST /user/ambassadorProgram/member": write("upsert"),
    "PATCH /user/ambassadorProgram/member/:userId": write("update"),
    "POST /user/ambassadorProgram/interaction": write("interaction"),
  }),
);

afterEach(() => {
  requests.length = 0;
  writeStatus = 200;
});

const seeded = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.ambassadorProgramAdmin(), dashboard);
  const invalidated = () =>
    query.client.getQueryState(queryKeys.ambassadorProgramAdmin())
      ?.isInvalidated;
  return { query, invalidated };
};

describe("useAmbassadorProgramAdmin", () => {
  it("reads the dashboard", async () => {
    const view = renderHook(() => useAmbassadorProgramAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(dashboard));
  });
});

describe.each([
  {
    name: "useUpsertAmbassadorProgramMemberAdmin",
    useWrite: () => {
      const mutation = useUpsertAmbassadorProgramMemberAdmin();
      return () => mutation.mutateAsync({ userId: 3, invited: true });
    },
    request: { path: "upsert", userId: 3, invited: true },
  },
  {
    name: "useUpdateAmbassadorProgramMemberAdmin",
    useWrite: () => {
      const mutation = useUpdateAmbassadorProgramMemberAdmin();
      return () =>
        mutation.mutateAsync({ userId: 3, body: { activeParticipant: false } });
    },
    request: { path: "update", userId: "3", activeParticipant: false },
  },
  {
    name: "useCreateAmbassadorProgramInteractionAdmin",
    useWrite: () => {
      const mutation = useCreateAmbassadorProgramInteractionAdmin();
      return () =>
        mutation.mutateAsync({
          userId: 3,
          text: "Called",
          interactionDate: "2026-10-05",
        });
    },
    request: {
      path: "interaction",
      userId: 3,
      text: "Called",
      interactionDate: "2026-10-05",
    },
  },
])("$name", ({ useWrite, request }) => {
  it("writes and refreshes the dashboard", async () => {
    const { query, invalidated } = seeded();
    const view = renderHook(useWrite, query);

    await view.result.current();

    expect(requests).toEqual([request]);
    await waitFor(() => expect(invalidated()).toBe(true));
  });

  it("leaves the dashboard alone after a refusal", async () => {
    writeStatus = 403;
    const { query, invalidated } = seeded();
    const view = renderHook(useWrite, query);

    await expect(view.result.current()).rejects.toBeDefined();

    expect(invalidated()).toBe(false);
  });
});
