import { CellAssignment } from "@alliance/common/suite-split";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import { EVERYONE_ELSE, GroupFallback } from "../src/suite-splits/split-groups";
import type { TestContext } from "./e2e-test-utils";

export type Draft = {
  id: string;
  name: string;
  text: string | null;
  fallback: GroupFallback | null;
  noRequiredWorkTick: boolean;
  cells: {
    actionId: number;
    assignment: CellAssignment.Required | CellAssignment.Optional;
  }[];
};

export type SplitBody = {
  versionId: number;
  groups: (Omit<Draft, "noRequiredWorkTick"> & {
    noRequiredWorkTick: string | null;
  })[];
  actions: { id: number; name: string }[];
  launched: boolean;
  launchFailedAt: string | null;
  launchFailure: string | null;
};

export const group = (
  name: string,
  text: string,
  cells: Draft["cells"] = [],
  fallback: GroupFallback | null = null,
): Draft => ({
  id: randomUUID(),
  name,
  text,
  fallback,
  noRequiredWorkTick: false,
  cells,
});

export const required = (actionId: number) => ({
  actionId,
  assignment: CellAssignment.Required as const,
});

export const optional = (actionId: number) => ({
  actionId,
  assignment: CellAssignment.Optional as const,
});

/** HTTP helpers and builders for split suites, as an admin. */
export function suiteSplitFixtures(ctx: TestContext) {
  const server = () => ctx.app.getHttpServer();
  const auth = () => `Bearer ${ctx.adminAccessToken}`;

  const createSuite = async (actionNames: string[]) => {
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: `split suite ${randomUUID()}` });
    const actionRepo = ctx.dataSource.getRepository(Action);
    const actions: Action[] = [];
    for (const name of actionNames) {
      actions.push(
        await actionRepo.save(
          actionRepo.create({
            name,
            body: "suite split e2e",
            category: [],
            visibilityMode: VisibilityMode.Public,
            cohortExpression: null,
            suite: { id: suite.id },
          }),
        ),
      );
    }
    return { suite, actions };
  };

  const convert = (suiteId: number) =>
    request(server())
      .post(`/actions/suite/${suiteId}/split`)
      .set("Authorization", auth());

  const get = async (suiteId: number): Promise<SplitBody> =>
    (
      await request(server())
        .get(`/actions/suite/${suiteId}/split`)
        .set("Authorization", auth())
        .expect(200)
    ).body;

  /** The groups as the editor would send them back, "Everyone else" last. */
  const drafts = (
    split: SplitBody,
    before: Draft[],
    everyoneElse: Draft["cells"] = [],
  ) => [
    ...before,
    {
      ...split.groups[split.groups.length - 1],
      noRequiredWorkTick: false,
      cells: everyoneElse,
    },
  ];

  const save = (suiteId: number, baseVersionId: number, groups: Draft[]) =>
    request(server())
      .post(`/actions/suite/${suiteId}/split/save`)
      .set("Authorization", auth())
      .send({ baseVersionId, groups });

  const preview = (suiteId: number, groups: Draft[]) =>
    request(server())
      .post(`/actions/suite/${suiteId}/split/preview`)
      .set("Authorization", auth())
      .send({ groups });

  /** A split suite whose groups are `before` plus "Everyone else". */
  const createSplit = async (params: {
    actionNames: string[];
    groups: (actions: Action[]) => Draft[];
    everyoneElse?: (actions: Action[]) => Draft["cells"];
  }) => {
    const { suite, actions } = await createSuite(params.actionNames);
    await convert(suite.id).expect(201);
    const split = await get(suite.id);
    const saved = await save(
      suite.id,
      split.versionId,
      drafts(split, params.groups(actions), params.everyoneElse?.(actions)),
    ).expect(200);
    expect(saved.body.problems).toEqual([]);
    const stored = await get(suite.id);
    expect(saved.body.split).toEqual(stored);
    return { suite, actions, split: stored };
  };

  const createList = async (name: string, userIds: number[]) =>
    (
      await request(server())
        .post("/member-lists")
        .set("Authorization", auth())
        .send({ name, userIds })
        .expect(201)
    ).body as { id: string; name: string; versionId: number };

  const saveFormulas = (body: Record<string, unknown>) =>
    request(server())
      .post("/formulas/save")
      .set("Authorization", auth())
      .send({ edits: [], deletions: [], ...body });

  const formulaVersion = async (id: string): Promise<number> => {
    const listed: { id: string; versionId: number }[] = (
      await request(server())
        .get("/formulas")
        .set("Authorization", auth())
        .expect(200)
    ).body;
    const found = listed.find((each) => each.id === id);
    if (found === undefined) throw new Error(`no formula ${id}`);
    return found.versionId;
  };

  return {
    formulaVersion,
    createSuite,
    convert,
    get,
    drafts,
    save,
    preview,
    createSplit,
    createList,
    saveFormulas,
    everyoneElseName: EVERYONE_ELSE,
  };
}
