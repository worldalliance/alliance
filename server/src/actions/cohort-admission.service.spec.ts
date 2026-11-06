import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In } from "typeorm";
import { CohortAdmissionService } from "./cohort-admission.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

const serviceWith = async (find: jest.Mock) =>
  (
    await Test.createTestingModule({
      providers: [
        CohortAdmissionService,
        {
          provide: getRepositoryToken(ActionCohortDecision),
          useValue: { find },
        },
      ],
    }).compile()
  ).get(CohortAdmissionService);

const failingFind = () =>
  jest.fn(async () => {
    throw new Error("connection terminated");
  });

describe("CohortAdmissionService.prefetchAdmittedActionIds", () => {
  it("fills each member's admitted actions from one query", async () => {
    const find = jest.fn(async () => [
      { userId: 1, actionId: 10 },
      { userId: 1, actionId: 11 },
    ]);
    const service = await serviceWith(find);
    const session = new CohortResolutionSession();

    await service.prefetchAdmittedActionIds([1, 2], session);

    expect(await service.loadAdmittedActionIds(1, session)).toEqual(
      new Set([10, 11]),
    );
    expect(await service.loadAdmittedActionIds(2, session)).toEqual(new Set());
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith({
      where: { userId: In([1, 2]), included: true },
      select: { userId: true, actionId: true },
    });
  });

  it("queries only the members the session hasn't memoized", async () => {
    const find = jest.fn(async () => []);
    const service = await serviceWith(find);
    const session = new CohortResolutionSession();
    session.admittedActionIdsByUser.set(1, Promise.resolve(new Set([9])));

    await service.prefetchAdmittedActionIds([1, 2], session);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: In([2]), included: true } }),
    );
    expect(await service.loadAdmittedActionIds(1, session)).toEqual(
      new Set([9]),
    );
  });

  it("rejects once and leaves the session unfilled when the query fails", async () => {
    const service = await serviceWith(failingFind());
    const session = new CohortResolutionSession();

    await expect(
      service.prefetchAdmittedActionIds([1, 2], session),
    ).rejects.toThrow("connection terminated");
    expect(session.admittedActionIdsByUser.size).toBe(0);
  });
});

describe("CohortAdmissionService.prefetchAdmittedMemberIds", () => {
  it("fills each action's admitted members from one query", async () => {
    const find = jest.fn(async () => [
      { actionId: 10, userId: 1 },
      { actionId: 10, userId: 2 },
    ]);
    const service = await serviceWith(find);
    const session = new CohortResolutionSession();

    await service.prefetchAdmittedMemberIds([10, 11], session);

    expect(await service.loadAdmittedMemberIds(10, session)).toEqual(
      new Set([1, 2]),
    );
    expect(await service.loadAdmittedMemberIds(11, session)).toEqual(new Set());
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith({
      where: { actionId: In([10, 11]), included: true },
      select: { userId: true, actionId: true },
    });
  });

  it("queries only the actions the session hasn't memoized", async () => {
    const find = jest.fn(async () => []);
    const service = await serviceWith(find);
    const session = new CohortResolutionSession();
    session.admittedUserIdsByAction.set(10, Promise.resolve(new Set([9])));

    await service.prefetchAdmittedMemberIds([10, 11], session);

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actionId: In([11]), included: true },
      }),
    );
    expect(await service.loadAdmittedMemberIds(10, session)).toEqual(
      new Set([9]),
    );
  });

  it("rejects once and leaves the session unfilled when the query fails", async () => {
    const service = await serviceWith(failingFind());
    const session = new CohortResolutionSession();

    await expect(
      service.prefetchAdmittedMemberIds([10, 11], session),
    ).rejects.toThrow("connection terminated");
    expect(session.admittedUserIdsByAction.size).toBe(0);
  });
});
