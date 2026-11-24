import { CellAssignment } from "@alliance/common/suite-partition";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { ActionSuite } from "../src/actions/entities/action-suite.entity";
import { Action, VisibilityMode } from "../src/actions/entities/action.entity";
import {
  EVERYONE_ELSE,
  PartFallback,
} from "../src/suite-partitions/partition-parts";
import type { TestContext } from "./e2e-test-utils";

export type Draft = {
  id: string;
  name: string;
  text: string | null;
  fallback: PartFallback | null;
  noRequiredWorkTick: boolean;
  cells: {
    actionId: number;
    assignment: CellAssignment.Required | CellAssignment.Optional;
  }[];
};

export type PartitionBody = {
  versionId: number;
  parts: (Omit<Draft, "noRequiredWorkTick"> & {
    noRequiredWorkTick: string | null;
  })[];
  actions: { id: number; name: string }[];
  launched: boolean;
  launchFailedAt: string | null;
  launchFailure: string | null;
};

export const part = (
  name: string,
  text: string,
  cells: Draft["cells"] = [],
  fallback: PartFallback | null = null,
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

/** HTTP helpers and builders for partitioned suites, as an admin. */
export function suitePartitionFixtures(ctx: TestContext) {
  const server = () => ctx.app.getHttpServer();
  const auth = () => `Bearer ${ctx.adminAccessToken}`;

  const createSuite = async (actionNames: string[]) => {
    const suite = await ctx.dataSource
      .getRepository(ActionSuite)
      .save({ name: `partitioned suite ${randomUUID()}` });
    const actionRepo = ctx.dataSource.getRepository(Action);
    const actions: Action[] = [];
    for (const name of actionNames) {
      actions.push(
        await actionRepo.save(
          actionRepo.create({
            name,
            body: "suite partition e2e",
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
      .post(`/actions/suite/${suiteId}/partition`)
      .set("Authorization", auth());

  const get = async (suiteId: number): Promise<PartitionBody> =>
    (
      await request(server())
        .get(`/actions/suite/${suiteId}/partition`)
        .set("Authorization", auth())
        .expect(200)
    ).body;

  /** The parts as the editor would send them back, "Everyone else" last. */
  const drafts = (
    partition: PartitionBody,
    before: Draft[],
    everyoneElse: Draft["cells"] = [],
  ) => [
    ...before,
    {
      ...partition.parts[partition.parts.length - 1],
      noRequiredWorkTick: false,
      cells: everyoneElse,
    },
  ];

  const save = (suiteId: number, baseVersionId: number, parts: Draft[]) =>
    request(server())
      .post(`/actions/suite/${suiteId}/partition/save`)
      .set("Authorization", auth())
      .send({ baseVersionId, parts });

  const preview = (suiteId: number, parts: Draft[]) =>
    request(server())
      .post(`/actions/suite/${suiteId}/partition/preview`)
      .set("Authorization", auth())
      .send({ parts });

  /** A partitioned suite whose parts are `before` plus "Everyone else". */
  const createPartition = async (params: {
    actionNames: string[];
    parts: (actions: Action[]) => Draft[];
    everyoneElse?: (actions: Action[]) => Draft["cells"];
  }) => {
    const { suite, actions } = await createSuite(params.actionNames);
    await convert(suite.id).expect(201);
    const partition = await get(suite.id);
    const saved = await save(
      suite.id,
      partition.versionId,
      drafts(partition, params.parts(actions), params.everyoneElse?.(actions)),
    ).expect(200);
    expect(saved.body.problems).toEqual([]);
    const stored = await get(suite.id);
    expect(saved.body.partition).toEqual(stored);
    return { suite, actions, partition: stored };
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
    createPartition,
    createList,
    saveFormulas,
    everyoneElseName: EVERYONE_ELSE,
  };
}
