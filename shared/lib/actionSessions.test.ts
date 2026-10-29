import { act, renderHook, waitFor } from "@testing-library/react";
import { useDismissActionMutation } from "./actionsListPage";
import { actionStore } from "./actionStore";
import { queryKeys } from "./queryKeys";
import { makeAction, makeFormResponse } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { seedActions } from "./testing/seedActions";
import { routes, serveApi } from "./testing/serveApi";
import { meCache } from "./useMe";
import { useTaskFormSubmission } from "./useTaskFormSubmission";

const api = serveApi(routes({}));

const useMutations = () => ({
  submission: useTaskFormSubmission(),
  dismissal: useDismissActionMutation(),
});

const mutations: {
  name: string;
  route: string;
  send: (mutations: ReturnType<typeof useMutations>) => Promise<unknown>;
}[] = [
  {
    name: "completion",
    route: "POST /tasks/submitForm/:id",
    send: ({ submission }) =>
      submission.submit({
        taskFormId: 7,
        body: { actionId: 1, answers: {}, deviceType: "mobile" },
        isMember: true,
      }),
  },
  {
    name: "deferred completion",
    route: "POST /tasks/submitForm/:id",
    send: async ({ submission }) => {
      await submission.submit({
        taskFormId: 7,
        body: { actionId: 1, answers: {}, deviceType: "mobile" },
        isMember: true,
        deferCompletion: true,
      });
      submission.recordCompleted({ actionId: 1, isMember: true });
    },
  },
  {
    name: "withdrawal",
    route: "POST /tasks/optout/:id",
    send: ({ submission }) =>
      submission.optOut(7, {
        actionId: 1,
        reason: "",
        outOfTime: true,
        isMoral: false,
      }),
  },
  {
    name: "dismissal",
    route: "POST /actions/dismiss/:id",
    send: ({ dismissal }) => dismissal.mutateAsync(1),
  },
];

it.each(mutations)(
  "ignores a $name response from the previous session",
  async ({ route, send }) => {
    const pending = Promise.withResolvers<Response>();
    let requested = false;
    api.alsoServing({
      [route]: () => {
        requested = true;
        return pending.promise;
      },
    });
    const { client, wrapper } = queryWrapper();
    seedActions(client, [makeAction({ id: 1 })]);
    const hook = renderHook(useMutations, { wrapper });
    const sent = send(hook.result.current);
    await waitFor(() => expect(requested).toBe(true));

    act(() => {
      meCache(client).clear();
      seedActions(client, [makeAction({ id: 1, name: "Another session" })]);
    });
    pending.resolve(Response.json(makeFormResponse()));
    await act(() => sent);

    expect(actionStore(client).get(1)?.viewer?.relation).toBe("none");
    expect(actionStore(client).get(1)?.viewer?.dismissed).toBe(false);
    expect(client.getQueryState(queryKeys.actions())?.isInvalidated).toBe(
      false,
    );
  },
);
