import type { FormSchema } from "@alliance/common/forms/form-schema";
import { act, cleanup, renderHook } from "@testing-library/react";
import { routes, serveApi } from "../lib/testing/serveApi";
import {
  HistoryReader,
  historySubject,
  SourceHistoriesStatus,
  useVariableSourceHistories,
  type HistorySubject,
  type SourceHistories,
} from "./useVariableSourceHistories";

afterEach(cleanup);

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

const render = (schema: FormSchema, subject: HistorySubject) =>
  renderHook(
    (props: { subject: HistorySubject }) =>
      useVariableSourceHistories({ schema, subject: props.subject }),
    { initialProps: { subject } },
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

    expect(result.current.status).toBe(SourceHistoriesStatus.SourceDeleted);
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
  it("fetches only a source form added while open, keeping the ones loaded", async () => {
    member["5:7"] = async () => json(historyBody([1]));
    member["5:8"] = async () => json(historyBody([2]));
    const subject = { reader: HistoryReader.Member, userId: 5 } as const;
    const { result, rerender } = renderHook(
      (props: { schema: FormSchema }) =>
        useVariableSourceHistories({ schema: props.schema, subject }),
      { initialProps: { schema: readingForms(7) } },
    );
    await settle();

    rerender({ schema: readingForms(7, 8) });
    expect(result.current.status).toBe(SourceHistoriesStatus.Loading);
    await settle();

    expect(scoresOf(result.current, 7)).toEqual([1]);
    expect(scoresOf(result.current, 8)).toEqual([2]);
    expect(requests).toEqual(["5:7", "5:8"]);
  });
});

describe("historySubject", () => {
  it("reads the previewed member, never the admin, in an admin renderer", () => {
    expect(historySubject({ adminPreviewUserId: 3, signedIn: true })).toEqual({
      reader: HistoryReader.Member,
      userId: 3,
    });
    expect(
      historySubject({ adminPreviewUserId: "preview", signedIn: true }),
    ).toEqual({ reader: HistoryReader.Nobody });
  });

  it("reads the signed-in member's own answers, and nobody's for a guest", () => {
    expect(
      historySubject({ adminPreviewUserId: undefined, signedIn: true }),
    ).toEqual({ reader: HistoryReader.Self });
    expect(
      historySubject({ adminPreviewUserId: undefined, signedIn: false }),
    ).toEqual({ reader: HistoryReader.Nobody });
  });
});
