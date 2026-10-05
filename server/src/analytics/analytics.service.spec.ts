import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ContractEvent,
  ContractEventType,
} from "src/user/entities/contract-event.entity";
import { AnalyticsService } from "./analytics.service";

const signedAt = new Date("2026-03-01T12:00:00Z");

const sameInstantEvents = [
  {
    id: 2,
    date: signedAt,
    type: ContractEventType.SUSPENDED,
    user: { id: 7 },
  },
  { id: 1, date: signedAt, type: ContractEventType.SIGNED, user: { id: 7 } },
];

const serviceWith = async () =>
  (
    await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(ContractEvent),
          useValue: { find: jest.fn(async () => sameInstantEvents) },
        },
        {
          provide: getRepositoryToken(ActionActivity),
          useValue: {
            createQueryBuilder: () => {
              const qb = {
                select: () => qb,
                addSelect: () => qb,
                where: () => qb,
                andWhere: () => qb,
                groupBy: () => qb,
                getRawMany: async () => [],
              };
              return qb;
            },
          },
        },
      ],
    })
      .useMocker(() => ({}))
      .compile()
  ).get(AnalyticsService);

describe("AnalyticsService contract status", () => {
  it("counts a member suspended at the instant they signed as churned", async () => {
    const service = await serviceWith();

    const [point] = await service.getContractStatusHistory(
      "2026-03-01",
      "2026-03-01",
    );

    expect(point).toMatchObject({
      activeCount: 0,
      churnedCount: 1,
      totalEverSigned: 1,
    });
  });

  it("samples a member suspended at the instant they signed", async () => {
    const service = await serviceWith();

    expect(await service.getTimeToChurnSamples()).toEqual([0]);
  });
});
