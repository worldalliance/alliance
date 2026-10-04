import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CohortResolutionSession } from "src/notifs/cohort-resolution-session";
import { CohortAdmissionService } from "./cohort-admission.service";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

describe("CohortAdmissionService.prefetchAdmittedActionIds", () => {
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
  });

  it("rejects once and leaves the session unfilled when the query fails", async () => {
    const service = await serviceWith(
      jest.fn(async () => {
        throw new Error("connection terminated");
      }),
    );
    const session = new CohortResolutionSession();

    await expect(
      service.prefetchAdmittedActionIds([1, 2], session),
    ).rejects.toThrow("connection terminated");
    expect(session.admittedActionIdsByUser.size).toBe(0);
  });
});
