import {
  VariableAggregatesStatus,
  type VariableAggregates,
} from "./useVariableAggregates";
import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "./useVariableSourceHistories";
import { variableInputsGate } from "./variableInputsGate";

const histories = {
  loading: { status: SourceHistoriesStatus.Loading },
  failed: (retry = () => {}) => ({
    status: SourceHistoriesStatus.Failed,
    retry,
  }),
  deleted: {
    status: SourceHistoriesStatus.SourceDeleted,
    sources: new Map(),
    deletedFormIds: new Set([1]),
  },
  ready: { status: SourceHistoriesStatus.Ready, sources: new Map() },
} satisfies Record<string, SourceHistories | (() => SourceHistories)>;

const aggregates = {
  loading: { status: VariableAggregatesStatus.Loading },
  failed: (retry = () => {}) => ({
    status: VariableAggregatesStatus.Failed,
    retry,
  }),
  unavailable: {
    status: VariableAggregatesStatus.SourceUnavailable,
    aggregates: new Map(),
  },
  ready: { status: VariableAggregatesStatus.Ready, aggregates: new Map() },
} satisfies Record<string, VariableAggregates | (() => VariableAggregates)>;

describe("variableInputsGate", () => {
  it.each([
    ["histories loading", histories.loading, aggregates.ready],
    ["aggregates loading", histories.ready, aggregates.loading],
    ["loading over a failure", histories.failed(), aggregates.loading],
  ])("waits while %s", (_, h, a) => {
    expect(variableInputsGate(h, a).status).toBe(SourceHistoriesStatus.Loading);
  });

  it("shows a failure over a deletion", () => {
    expect(
      variableInputsGate(histories.deleted, aggregates.failed()).status,
    ).toBe(SourceHistoriesStatus.Failed);
  });

  it("retries only what failed", () => {
    const retried: string[] = [];
    const gate = variableInputsGate(
      histories.failed(() => retried.push("histories")),
      aggregates.ready,
    );
    if (gate.status !== SourceHistoriesStatus.Failed)
      throw new Error("not failed");
    gate.retry();
    expect(retried).toEqual(["histories"]);
  });

  it("retries both when both failed", () => {
    const retried: string[] = [];
    const gate = variableInputsGate(
      histories.failed(() => retried.push("histories")),
      aggregates.failed(() => retried.push("aggregates")),
    );
    if (gate.status !== SourceHistoriesStatus.Failed)
      throw new Error("not failed");
    gate.retry();
    expect(retried).toEqual(["histories", "aggregates"]);
  });

  it.each([
    ["an unavailable count", histories.ready, aggregates.unavailable],
    ["a deleted history source", histories.deleted, aggregates.ready],
  ])("reports %s as deleted", (_, h, a) => {
    expect(variableInputsGate(h, a).status).toBe(
      SourceHistoriesStatus.SourceDeleted,
    );
  });

  it("is ready when both are", () => {
    expect(variableInputsGate(histories.ready, aggregates.ready).status).toBe(
      SourceHistoriesStatus.Ready,
    );
  });
});
