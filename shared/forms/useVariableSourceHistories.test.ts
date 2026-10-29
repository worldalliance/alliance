import type { FormSchema } from "@alliance/common/forms/form-schema";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { queryWrapper } from "../lib/testing/queryWrapper";
import {
  refetchingWrapper,
  refocusAndReconnect,
} from "../lib/testing/refocusAndReconnect";
import { routes, serveApi } from "../lib/testing/serveApi";
import {
  HistoryReader,
  historySubject,
  SourceHistoriesStatus,
  useVariableSourceHistories,
  type HistorySubject,
  type SourceHistories,
} from "./useVariableSourceHistories";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sourceSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "score", type: "input", kind: "number", label: "Score" }],
    },
  ],
  outputViews: [],
};

const historyBody = (scores: number[]) => ({
  schema: sourceSchema,
  responses: scores.map((score, index) => ({
    id: index + 1,
    answers: { score },
    schemaSnapshot: sourceSchema,
    formulaChoices: {},
  })),
});

const readingForms = (...formIds: number[]): FormSchema => ({
  pages: [{ id: "p1", fields: [] }],
  outputViews: [],
  variables: [
    {
      name: "v",
      inputs: Object.fromEntries(
        formIds.map((sourceFormId, index) => [
          `input${index + 1}`,
          { kind: "sourceField", fieldId: "score", sourceFormId },
        ]),
      ),
      formula: "0",
    },
  ],
});

type Answer = () => Promise<Response>;
let mine: Record<string, Answer>;
let member: Record<string, Answer>;
let requests: string[];

serveApi(
  routes({
    "GET /tasks/myResponseHistory/:id": ({ params }) => {
      requests.push(`me:${params.id}`);
      return mine[params.id]();
    },
    "GET /tasks/responseHistory/:formId/user/:userId": ({ params }) => {
      requests.push(`${params.userId}:${params.formId}`);
      return member[`${params.userId}:${params.formId}`]();
    },
  }),
);

beforeEach(() => {
  mine = {};
  member = {};
  requests = [];
});

const settle = async () => {
  for (let tick = 0; tick < 5; tick += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

const scoresOf = (histories: SourceHistories, formId: number) =>
  histories.status === SourceHistoriesStatus.Ready
    ? histories.sources
        .get(formId)
        ?.responses.map((response) => response.answers.score)
    : histories.status;

const render = (
  schema: FormSchema,
  subject: HistorySubject,
  wrapper = queryWrapper().wrapper,
) =>
  renderHook(
    (props: { subject: HistorySubject }) =>
      useVariableSourceHistories({ schema, subject: props.subject }),
    { initialProps: { subject }, wrapper },
  );

describe("useVariableSourceHistories", () => {
  it("is ready at once with nothing to load for a form reading no other form", () => {
    const { result } = render(readingForms(), { reader: HistoryReader.Self });
    expect(result.current.status).toBe(SourceHistoriesStatus.Ready);
  });

  it("gives nobody's history as empty at once, without asking the server", async () => {
    const { result } = render(readingForms(7), {
      reader: HistoryReader.Nobody,
    });
    expect(scoresOf(result.current, 7)).toEqual([]);
    await settle();
    expect(scoresOf(result.current, 7)).toEqual([]);
    expect(requests).toEqual([]);
  });

  it("holds the form without asking the server until it's known who is signed in", async () => {
    const { result } = render(readingForms(7), {
      reader: HistoryReader.Pending,
    });
    await settle();
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);
    expect(requests).toEqual([]);
  });

  it("doesn't hold a form reading no other form while sign-in resolves", () => {
    const { result } = render(readingForms(), {
      reader: HistoryReader.Pending,
    });
    expect(result.current.status).toBe(SourceHistoriesStatus.Ready);
  });

  it("loads the member's own history once sign-in resolves to them", async () => {
    mine["7"] = async () => json(historyBody([3]));
    const { result, rerender } = render(readingForms(7), {
      reader: HistoryReader.Pending,
    });
    await settle();

    rerender({ subject: { reader: HistoryReader.Self } });
    await settle();
    expect(scoresOf(result.current, 7)).toEqual([3]);
    expect(requests).toEqual(["me:7"]);
  });

  it("gives an empty history without asking the server once sign-in resolves to no one", async () => {
    const { result, rerender } = render(readingForms(7), {
      reader: HistoryReader.Pending,
    });
    await settle();

    rerender({ subject: { reader: HistoryReader.Nobody } });
    await settle();
    expect(scoresOf(result.current, 7)).toEqual([]);
    expect(requests).toEqual([]);
  });

  it("loads the member's own history, holding the form until it lands", async () => {
    let land: (response: Response) => void = () => {};
    mine["7"] = () => new Promise((resolve) => (land = resolve));

    const { result } = render(readingForms(7), { reader: HistoryReader.Self });
    await settle();
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);

    land(json(historyBody([5, 8])));
    await settle();
    expect(scoresOf(result.current, 7)).toEqual([5, 8]);
  });

  it("fails rather than read a failed load as no submissions, and retries only the form that failed", async () => {
    mine["7"] = async () => json(historyBody([1]));
    mine["8"] = async () => json({ message: "down" }, 500);

    const { result } = render(readingForms(7, 8), {
      reader: HistoryReader.Self,
    });
    await settle();
    expect(result.current.status).toBe(SourceHistoriesStatus.Failed);

    mine["8"] = async () => json(historyBody([2]));
    act(() => {
      if (result.current.status === SourceHistoriesStatus.Failed) {
        result.current.retry();
      }
    });
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([1]);
    expect(scoresOf(result.current, 8)).toEqual([2]);
    expect(requests).toEqual(["me:7", "me:8", "me:8"]);
  });

  it("reports a deleted source form apart from a failed load, since retrying can't help", async () => {
    mine["7"] = async () => json(historyBody([1]));
    mine["8"] = async () => json({ message: "Form not found" }, 404);

    const { result } = render(readingForms(7, 8), {
      reader: HistoryReader.Self,
    });
    await settle();

    const histories = result.current;
    if (histories.status !== SourceHistoriesStatus.SourceDeleted) {
      throw new Error(`expected a deleted source, got ${histories.status}`);
    }
    expect(histories.deletedFormIds).toEqual(new Set([8]));
    expect([...histories.sources.keys()]).toEqual([7]);
  });

  it("offers a retry for a failed load even beside a deleted form", async () => {
    mine["7"] = async () => json({ message: "down" }, 500);
    mine["8"] = async () => json({ message: "Form not found" }, 404);

    const { result } = render(readingForms(7, 8), {
      reader: HistoryReader.Self,
    });
    await settle();

    expect(result.current.status).toBe(SourceHistoriesStatus.Failed);
  });

  it("drops a late answer for the member an admin switched away from", async () => {
    let landFirst: (response: Response) => void = () => {};
    member["1:7"] = () => new Promise((resolve) => (landFirst = resolve));
    member["2:7"] = async () => json(historyBody([20]));

    const { result, rerender } = render(readingForms(7), {
      reader: HistoryReader.Member,
      userId: 1,
    });
    await settle();
    rerender({ subject: { reader: HistoryReader.Member, userId: 2 } });
    await settle();
    landFirst(json(historyBody([10])));
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([20]);
    expect(requests).toEqual(["1:7", "2:7"]);
  });

  it("keeps the loaded history while the form stays open", async () => {
    mine["7"] = async () => json(historyBody([1]));
    const { result, rerender } = render(readingForms(7), {
      reader: HistoryReader.Self,
    });
    await settle();

    mine["7"] = async () => json(historyBody([1, 2]));
    rerender({ subject: { reader: HistoryReader.Self } });
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([1]);
    expect(requests).toEqual(["me:7"]);
  });

  it("refetches every history when reloaded", async () => {
    mine["7"] = async () => json(historyBody([1]));
    const schema = readingForms(7);
    const subject = { reader: HistoryReader.Self } as const;
    const { result, rerender } = renderHook(
      (props: { reload: number }) =>
        useVariableSourceHistories({ schema, subject, reload: props.reload }),
      { initialProps: { reload: 0 }, wrapper: queryWrapper().wrapper },
    );
    await settle();

    mine["7"] = async () => json(historyBody([1, 2]));
    rerender({ reload: 1 });
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([1, 2]);
    expect(requests).toEqual(["me:7", "me:7"]);
  });

  it("fetches only a source form added while open, keeping the ones loaded", async () => {
    member["5:7"] = async () => json(historyBody([1]));
    member["5:8"] = async () => json(historyBody([2]));
    const subject = { reader: HistoryReader.Member, userId: 5 } as const;
    const { result, rerender } = renderHook(
      (props: { schema: FormSchema }) =>
        useVariableSourceHistories({ schema: props.schema, subject }),
      {
        initialProps: { schema: readingForms(7) },
        wrapper: queryWrapper().wrapper,
      },
    );
    await settle();

    rerender({ schema: readingForms(7, 8) });
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([1]);
    expect(scoresOf(result.current, 8)).toEqual([2]);
    expect(requests).toEqual(["5:7", "5:8"]);
  });

  it("doesn't retry a failed load on its own, whatever the app's retries", async () => {
    mine["7"] = async () => json({ message: "down" }, 500);
    const { wrapper } = queryWrapper({ retry: 3, retryDelay: 0 });
    const { result } = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      wrapper,
    );
    await settle();
    expect(result.current.status).toBe(SourceHistoriesStatus.Failed);
    expect(requests).toEqual(["me:7"]);
  });

  it("waits for retry after a failed load, through refocus and reconnect", async () => {
    mine["7"] = async () => json({ message: "down" }, 500);
    const { result } = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      refetchingWrapper(),
    );
    await settle();

    mine["7"] = async () => json(historyBody([1]));
    await refocusAndReconnect(settle);
    expect(result.current.status).toBe(SourceHistoriesStatus.Failed);
    expect(requests).toEqual(["me:7"]);
  });

  it("keeps a deleted source form deleted through refocus and reconnect", async () => {
    mine["7"] = async () => json({ message: "Form not found" }, 404);
    const { result } = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      refetchingWrapper(),
    );
    await settle();

    await refocusAndReconnect(settle);
    expect(result.current.status).toBe(SourceHistoriesStatus.SourceDeleted);
    expect(requests).toEqual(["me:7"]);
  });

  it("fails rather than waiting for the network while offline", async () => {
    onlineManager.setOnline(false);
    try {
      mine["7"] = () => Promise.reject(new TypeError("Failed to fetch"));
      const { result } = render(readingForms(7), {
        reader: HistoryReader.Self,
      });
      await settle();
      expect(result.current.status).toBe(SourceHistoriesStatus.Failed);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("shows loading again while a retry is out", async () => {
    mine["7"] = async () => json({ message: "down" }, 500);
    const { result } = render(readingForms(7), { reader: HistoryReader.Self });
    await settle();
    const failed = result.current;
    if (failed.status !== SourceHistoriesStatus.Failed) {
      throw new Error(`expected a failure, got ${failed.status}`);
    }

    mine["7"] = () => new Promise(() => {});
    act(() => failed.retry());
    await settle();
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);
  });

  it("keeps an open form's histories when the window regains focus", async () => {
    mine["7"] = async () => json(historyBody([1]));
    const { result } = render(readingForms(7), { reader: HistoryReader.Self });
    await settle();

    mine["7"] = async () => json(historyBody([1, 2]));
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await settle();
    focusManager.setFocused(undefined);
    expect(scoresOf(result.current, 7)).toEqual([1]);
    expect(requests).toEqual(["me:7"]);
  });

  it("loads the histories afresh when the form reopens, whatever the app's staleTime", async () => {
    const { wrapper } = queryWrapper({ staleTime: 5 * 60 * 1000 });
    mine["7"] = async () => json(historyBody([1]));
    const first = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      wrapper,
    );
    await settle();
    first.unmount();
    await settle();

    mine["7"] = async () => json(historyBody([1, 2]));
    const second = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      wrapper,
    );
    expect(second.result.current.status).toBe(SourceHistoriesStatus.Loading);
    await settle();
    expect(scoresOf(second.result.current, 7)).toEqual([1, 2]);
    expect(requests).toEqual(["me:7", "me:7"]);
  });

  it("loads afresh for a form opened while another reading the same source stays open", async () => {
    const { wrapper } = queryWrapper();
    mine["7"] = async () => json(historyBody([1]));
    const first = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      wrapper,
    );
    await settle();

    mine["7"] = async () => json(historyBody([1, 2]));
    const second = render(
      readingForms(7),
      { reader: HistoryReader.Self },
      wrapper,
    );
    await settle();
    expect(scoresOf(second.result.current, 7)).toEqual([1, 2]);
    expect(scoresOf(first.result.current, 7)).toEqual([1]);
    expect(requests).toEqual(["me:7", "me:7"]);
  });

  it("keeps its result between renders while nothing loads", async () => {
    mine["7"] = async () => json(historyBody([1]));
    const { result, rerender } = render(readingForms(7), {
      reader: HistoryReader.Self,
    });
    await settle();
    const loaded = result.current;
    rerender({ subject: { reader: HistoryReader.Self } });
    expect(result.current).toBe(loaded);
  });
});

describe("historySubject", () => {
  it("reads the previewed member, never the admin, in an admin renderer", () => {
    expect(
      historySubject({
        adminPreviewUserId: 3,
        signedIn: true,
        userLoading: false,
      }),
    ).toEqual({
      reader: HistoryReader.Member,
      userId: 3,
    });
    expect(
      historySubject({
        adminPreviewUserId: "preview",
        signedIn: true,
        userLoading: false,
      }),
    ).toEqual({ reader: HistoryReader.Nobody });
  });

  it("reads the signed-in member's own answers, and nobody's for a guest", () => {
    expect(
      historySubject({
        adminPreviewUserId: undefined,
        signedIn: true,
        userLoading: false,
      }),
    ).toEqual({ reader: HistoryReader.Self });
    expect(
      historySubject({
        adminPreviewUserId: undefined,
        signedIn: false,
        userLoading: false,
      }),
    ).toEqual({ reader: HistoryReader.Nobody });
  });

  it("waits while it isn't known who is signed in", () => {
    expect(
      historySubject({
        adminPreviewUserId: undefined,
        signedIn: false,
        userLoading: true,
      }),
    ).toEqual({ reader: HistoryReader.Pending });
  });
});
