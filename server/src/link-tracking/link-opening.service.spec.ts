import { LinkOpeningPlatform } from "@alliance/common/linkOpening";
import { R } from "@alliance/common/result";
import { Test } from "@nestjs/testing";
import { PosthogService } from "src/posthog/posthog.service";
import { DataSource, QueryFailedError } from "typeorm";
import {
  LinkOpeningRejection,
  LinkOpeningService,
} from "./link-opening.service";

describe("LinkOpeningService", () => {
  it("refuses an opening whose recipient was deleted as it was recorded", async () => {
    const foreignKeyViolation = new QueryFailedError(
      "INSERT INTO link_opening",
      [],
      Object.assign(new Error("violates foreign key constraint"), {
        code: "23503",
      }),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkOpeningService,
        {
          provide: DataSource,
          useValue: { transaction: () => Promise.reject(foreignKeyViolation) },
        },
        { provide: PosthogService, useValue: { capture: () => undefined } },
      ],
    }).compile();
    const now = new Date();

    const recorded = await moduleRef.get(LinkOpeningService).record({
      dto: {
        openingId: "00000000-0000-4000-8000-000000000000",
        trackingId: "track-1",
        destination: "/tasks",
        platform: LinkOpeningPlatform.Web,
        observedAt: now,
      },
      now,
    });

    expect(recorded).toEqual(R.failure(LinkOpeningRejection.Unknown));
  });
});
